import { NextResponse } from "next/server"
import { createClient } from "./supabase/server"

export async function requireAdmin() {
    // no ADMIN_USER_ID -> fail closed, loudly
    const adminId = process.env.ADMIN_USER_ID
    if (!adminId) {
        console.error('[require-admin] ADMIN_USER_ID is not set; denying all admin requests')
        return NextResponse.json(
            { error: 'Unauthorized'},
            { status: 401 }
        )
    }

    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user || user.id !== adminId) {
        return NextResponse.json(
            { error: 'Unauthorized'},
            { status: 401 }
        )
    }

    return user
    
}