import 'server-only'
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { revalidatePublicContent } from "@/lib/cache/public-cache";
import type { TablesUpdate } from "@/types/database";

export const dynamic = 'force-dynamic'

// Only these columns are written; spreading the raw body let a caller set any column.
const EDITABLE_FIELDS = [
  'creator_name', 'donation_message', 'ea_headline', 'ea_subtext',
  'facebook_url', 'instagram_url', 'kofi_url', 'logo_url', 'patreon_url',
  'paypal_url', 'site_description', 'site_title', 'tiktok_url',
  'twitter_url', 'youtube_url',
] as const satisfies ReadonlyArray<keyof TablesUpdate<'settings'>>

// Public GET uses the service role, so columns are listed by hand: a new secret column stays private.
const PUBLIC_FIELDS = `
  creator_name, donation_message, ea_headline, ea_subtext, facebook_url,
  instagram_url, kofi_url, logo_url, patreon_url, paypal_url,
  site_description, site_title, tiktok_url, twitter_url, youtube_url
`

// Public: the donate and early access pages need it.
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
    const { data, error } = await supabaseAdmin
      .from("settings")
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    result = data
  } else {
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
