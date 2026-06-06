"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReCAPTCHA from "react-google-recaptcha";
import type { Database } from "@/types/database";


// ─── Types ────────────────────────────────────────────────────────────────────

type Settings = Database["public"]["Tables"]["settings"]["Row"];

type FormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "duplicate" }
  | { status: "error"; message: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Lock icon for the "early access chapters" visual
function LockBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      🔒 Early Access
    </span>
  );
}

// Success state — replaces the form after signup
function SuccessView({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      {/* Animated checkmark */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl dark:bg-green-900/30">
        🎉
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">You&apos;re in!</h2>
        <p className="text-muted-foreground">{message}</p>
      </div>

      <Link
        href="/comics"
        className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Browse the comics
      </Link>
    </div>
  );
}

// Duplicate state — friendly message if they've already signed up
function DuplicateView() {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-4xl dark:bg-blue-900/30">
        ✨
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          You&apos;re already on the list!
        </h2>
        <p className="text-muted-foreground">
          We already have your email. We&apos;ll reach out when early access chapters drop!
        </p>
      </div>

      <Link
        href="/comics"
        className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Read the comics
      </Link>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

// ✅ correct
export default function EarlyAccessPage() {
  const router = useRouter()

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_EARLY_ACCESS_ENABLED !== 'true') {
      router.replace('/')
    }
  }, [router])
  const [settings, setSettings] = useState<Settings | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>({ status: "idle" });
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  // ── Fetch settings on mount ──────────────────────────────────────────────
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const json = (await res.json()) as { settings: Settings | null };
        setSettings(json.settings);
      } catch {
        // Settings are optional — page still works without them
      }
    }
    void fetchSettings();
  }, []);

  // ── Derived content from settings ───────────────────────────────────────
  const headline = settings?.ea_headline ?? "Get Early Access";
  const subtext =
    settings?.ea_subtext ??
    "Sign up to read new chapters before everyone else. Free — no payment required.";

  // ── Email validation on blur ─────────────────────────────────────────────
  function handleEmailBlur() {
    if (email && !isValidEmail(email)) {
      setEmailError("Please enter a valid email address.");
    } else {
      setEmailError(null);
    }
  }

  // ── Form submission ──────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Client-side validation before hitting the API
    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    // Get reCAPTCHA token
    const recaptchaToken = recaptchaRef.current?.getValue() ?? "";
    if (!recaptchaToken) {
      setFormState({
        status: "error",
        message: "Please complete the reCAPTCHA check.",
      });
      return;
    }

    setFormState({ status: "loading" });

    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), recaptchaToken }),
      });

      const json = (await res.json()) as {
        message?: string;
        error?: string;
      };

      if (res.status === 409) {
        // Duplicate email
        setFormState({ status: "duplicate" });
        return;
      }

      if (!res.ok) {
        setFormState({
          status: "error",
          message: json.error ?? "Something went wrong. Please try again.",
        });
        // Reset reCAPTCHA so they can try again
        recaptchaRef.current?.reset();
        return;
      }

      setFormState({
        status: "success",
        message:
          json.message ??
          "You're on the list! We'll reach out when early access drops.",
      });
    } catch {
      setFormState({
        status: "error",
        message: "Network error. Please check your connection and try again.",
      });
      recaptchaRef.current?.reset();
    }
  }

  const isLoading = formState.status === "loading";
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";

  return (
    <main className="flex-1">
      {/* ── Hero section ──────────────────────────────────────────────────── */}
      <section className="border-b border-border bg-muted/30 px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl space-y-4">
          <LockBadge />
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {headline}
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            {subtext}
          </p>
        </div>
      </section>

      {/* ── Form section ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {/* Render form or result depending on state */}
          {formState.status === "success" ? (
            <SuccessView message={formState.message} />
          ) : formState.status === "duplicate" ? (
            <DuplicateView />
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-sm font-medium leading-none"
                >
                  Your email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    // Clear error as soon as they start typing again
                    if (emailError) setEmailError(null);
                    // Clear API errors too
                    if (formState.status === "error")
                      setFormState({ status: "idle" });
                  }}
                  onBlur={handleEmailBlur}
                  placeholder="you@example.com"
                  disabled={isLoading}
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  aria-describedby={emailError ? "email-error" : undefined}
                  aria-invalid={Boolean(emailError)}
                />
                {/* Email validation error */}
                {emailError && (
                  <p
                    id="email-error"
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {emailError}
                  </p>
                )}
              </div>

              {/* reCAPTCHA widget */}
              <div className="flex justify-center">
                {siteKey ? (
                  <ReCAPTCHA ref={recaptchaRef} sitekey={siteKey} />
                ) : (
                  // Development fallback when NEXT_PUBLIC_RECAPTCHA_SITE_KEY isn't set yet
                  <div className="flex h-16 w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-xs text-muted-foreground">
                    reCAPTCHA — add NEXT_PUBLIC_RECAPTCHA_SITE_KEY to .env.local
                  </div>
                )}
              </div>

              {/* API error message */}
              {formState.status === "error" && (
                <div
                  role="alert"
                  className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {formState.message}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    {/* Spinner — pure CSS, no library needed */}
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
                      aria-hidden="true"
                    />
                    Signing you up…
                  </span>
                ) : (
                  "Sign me up for early access 🔒"
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                No spam ever. Unsubscribe anytime.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── What is early access section ──────────────────────────────────── */}
      <section className="border-t border-border bg-muted/30 px-4 py-12">
        <div className="mx-auto max-w-2xl space-y-8 text-center">
          <h2 className="text-lg font-bold tracking-tight">
            What is early access?
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                icon: "📖",
                title: "Read chapters first",
                desc: "New chapters unlock for you before they go public.",
              },
              {
                icon: "💌",
                title: "Email notification",
                desc: "We'll email you the moment a new chapter drops.",
              },
              {
                icon: "💙",
                title: "Always free",
                desc: "No payment, no subscription. Just sign up and enjoy.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border bg-card p-5 text-left"
              >
                <p className="mb-2 text-2xl">{item.icon}</p>
                <p className="mb-1 text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            Want to support more directly?{" "}
            <Link
              href="/donate"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Donate here
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}