import { NextResponse } from "next/server"
import { createClient } from "./supabase/server"

export async function requireAdmin() {
    // Fail closed, loudly: without this, a missing ADMIN_USER_ID only locks
    // everyone out by accident (user.id !== undefined) and leaves no trace.
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