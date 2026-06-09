import 'server-only'
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";


// ─── DELETE /api/early-access/[id] ───────────────────────────────────────────
// Admin only — deletes a single early access email row by id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing id." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("early_access")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete email." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Email deleted." });
  } catch (err) {
    console.error("Early access DELETE error:", err);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}