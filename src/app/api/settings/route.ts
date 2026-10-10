import 'server-only'
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { revalidatePublicContent } from "@/lib/cache/public-cache";
import type { TablesUpdate } from "@/types/database";

export const dynamic = 'force-dynamic'

// Columns the admin may edit. Everything else in the body (id, updated_at,
// unknown keys) is ignored rather than written — spreading the raw body
// into the update let a caller set any column.
const EDITABLE_FIELDS = [
  'creator_name', 'donation_message', 'ea_headline', 'ea_subtext',
  'facebook_url', 'instagram_url', 'kofi_url', 'logo_url', 'patreon_url',
  'paypal_url', 'site_description', 'site_title', 'tiktok_url',
  'twitter_url', 'youtube_url',
] as const satisfies ReadonlyArray<keyof TablesUpdate<'settings'>>

// Columns the public GET returns. Listed by hand, not '*', because GET is
// public and uses the service role (no RLS): a column added to settings later
// (e.g. an API key) must stay private unless someone deliberately adds it
// here. Kept separate from EDITABLE_FIELDS for the same reason: "the admin
// can edit it" doesn't mean "visitors may read it".
const PUBLIC_FIELDS = `
  creator_name, donation_message, ea_headline, ea_subtext, facebook_url,
  instagram_url, kofi_url, logo_url, patreon_url, paypal_url,
  site_description, site_title, tiktok_url, twitter_url, youtube_url
`

// ─── GET /api/settings ────────────────────────────────────────────────────────
// Public — donate page and early-access page need this without auth
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("settings")
      .select(PUBLIC_FIELDS)
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
  revalidatePublicContent('PATCH /api/settings');

  try {
  const body = await req.json() as Record<string, unknown>

    const payload: TablesUpdate<'settings'> = {}
    for (const field of EDITABLE_FIELDS) {
      if (!(field in body)) continue
      const value = body[field]
      if (value !== null && typeof value !== 'string') {
        return NextResponse.json(
          { error: `${field} must be a string or null.` },
          { status: 400 }
        );
      }
      payload[field] = value
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { error: "No editable fields provided." },
        { status: 400 }
      );
    }
    payload.updated_at = new Date().toISOString()

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
