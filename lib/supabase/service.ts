import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Service-role client — bypasses RLS. SERVER-ONLY (never import from a client
// component). Use for privileged writes such as audit logging, where there is
// intentionally no user-facing INSERT policy on the table.
export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
