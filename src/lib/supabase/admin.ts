import 'server-only'
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export function getsupabaseAdmin() {
    return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

// Lazy proxy: every property access (e.g. `supabaseAdmin.from(...)`) builds
// a fresh client at that moment, inside the request — never at module load.
// This lets all existing `import { supabaseAdmin }` call sites keep working
// unchanged, instead of editing 20+ route files individually.
export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
    get(_target, prop) {
        const client = getsupabaseAdmin();
        const value  = Reflect.get(client, prop, client);
        return typeof value === 'function' ? value.bind(client) : value;
    },
});