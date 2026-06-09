import 'server-only'
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = 'force-dynamic'

// ─── GET /api/settings ────────────────────────────────────────────────────────
// Public — donate page and early-access page need this without auth
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("settings")
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ settings: null });
      }
      console.error("Settings GET error:", error);
      return NextResponse.json(
        { error: "Failed to fetch settings." },
        { status: 500 }
      );
    }

    return NextResponse.json({ settings: data });
  } catch (err) {
    console.error("Settings GET error:", err);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/settings ──────────────────────────────────────────────────────
// Admin only — upserts the settings row
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
  const body = await req.json() as Record<string, unknown>

    const payload = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabaseAdmin
      .from("settings")
      .select()
      .single();

  let result 
  if (existing?.id) {
    //Row exist - update it 
    const { data, error } = await supabaseAdmin
      .from("settings")
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    result = data
  } else {
    //No row - insert Fresh
    const { data, error } = await supabaseAdmin
      .from('settings')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    result = data
  }

  return NextResponse.json({ settings: result });
  } catch (err) {
    console.error("Settings PATCH error:", err);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
