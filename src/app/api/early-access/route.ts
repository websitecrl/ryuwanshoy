import 'server-only'
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function verifyRecaptcha(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return false;  
  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${secret}&response=${token}`,
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success: boolean };
  return data.success === true;
}

async function addToMailchimp(email: string): Promise<void> {
  const apiKey       = process.env.MAILCHIMP_API_KEY;
  const audienceId   = process.env.MAILCHIMP_AUDIENCE_ID;
  const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX;
  if (!apiKey || !audienceId || !serverPrefix) {
    console.warn("Mailchimp not configured — skipping sync");
    return;
  }
  const res = await fetch(
    `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${audienceId}/members`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
      },
      body: JSON.stringify({
        email_address: email.trim().toLowerCase(),
        status: "subscribed",
        tags: ["early-access"],
      }),
    }
  );
  if (!res.ok) {
    const body = (await res.json()) as { title?: string };
    if (body.title !== "Member Exists") {
      console.error("Mailchimp error:", body.title);
    }
  }
}

// ─── POST — public, anyone can sign up ───────────────────────────────────────
export async function POST(req: NextRequest) {
    if (process.env.NEXT_PUBLIC_EARLY_ACCESS_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Early access signup is not currently available." },
      { status: 403 }
    );
  }
  
  const ip = getClientIp(req)
  const allowed = await checkRateLimit(`early-access:${ip}`, 3, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429 }
    );
  }

  const supabase = await createClient();
  try {
    const body = (await req.json()) as {
      email?: string;
      recaptchaToken?: string;
    };
    const email          = body.email?.trim().toLowerCase() ?? "";
    const recaptchaToken = body.recaptchaToken ?? "";

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    if (!recaptchaToken) {
      return NextResponse.json(
        { error: "Please complete the reCAPTCHA check." },
        { status: 400 }
      );
    }
    const recaptchaOk = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaOk) {
      return NextResponse.json(
        { error: "reCAPTCHA verification failed. Please try again." },
        { status: 400 }
      );
    }
    const { error: dbError } = await supabase
      .from("early_access")
      .insert({ email });

    if (dbError) {
      if (dbError.code === "23505") {
        return NextResponse.json(
          { error: "duplicate", message: "You're already on the list!" },
          { status: 409 }
        );
      }
      console.error("Supabase insert error:", dbError);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }
    addToMailchimp(email).catch((err) =>
      console.error("Mailchimp sync failed:", err)
    );
    return NextResponse.json(
      { message: "You're on the list! We'll reach out when early access drops." },
      { status: 201 }
    );
  } catch (err) {
    console.error("Early access POST error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

// ─── GET — admin only ─────────────────────────────────────────────────────────
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { data, error } = await supabaseAdmin
      .from("early_access")
      .select("id, email, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch emails." },
        { status: 500 }
      );
    }
    return NextResponse.json({ emails: data ?? [] });
  } catch (err) {
    console.error("Early access GET error:", err);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}