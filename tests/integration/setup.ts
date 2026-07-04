import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Prefer a dedicated TEST project when its env vars are present; otherwise
// fall back to the dev project. On the free tier we only have one project,
// so tests run against `mokjang-dev`. To stay safe, cleanup() below only ever
// deletes data created by test users (see TEST_EMAIL_PREFIX / DOMAIN).
const URL = process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL || !SERVICE_KEY || !ANON_KEY) {
  throw new Error(
    "Missing Supabase env for integration tests. Set TEST_SUPABASE_* or dev NEXT_PUBLIC_SUPABASE_* / SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
}

// Test-created auth users are tagged by this email pattern so cleanup can
// target ONLY them and the groups they created — never real org data.
export const TEST_EMAIL_PREFIX = "test-";
export const TEST_EMAIL_DOMAIN = "@example.test";

function isTestEmail(email: string | undefined): boolean {
  return (
    !!email &&
    email.startsWith(TEST_EMAIL_PREFIX) &&
    email.endsWith(TEST_EMAIL_DOMAIN)
  );
}

export function adminClient() {
  return createClient<Database>(URL!, SERVICE_KEY!, {
    auth: { persistSession: false },
  });
}

export function anonClient(accessToken?: string) {
  return createClient<Database>(URL!, ANON_KEY!, {
    auth: { persistSession: false },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
}

let counter = 0;

export async function createTestUser(): Promise<{
  userId: string;
  email: string;
  accessToken: string;
}> {
  const admin = adminClient();
  const email = `${TEST_EMAIL_PREFIX}${Date.now()}-${counter++}${TEST_EMAIL_DOMAIN}`;
  const password = "TestPass!23";

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const { data: session, error: signInErr } = await anonClient().auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !session.session) throw signInErr ?? new Error("signIn failed");

  return {
    userId: data.user.id,
    email,
    accessToken: session.session.access_token,
  };
}

// SAFE cleanup: only removes test users and the groups those test users
// created. Memberships and profiles cascade via FK. Real organization data
// (created by non-test users) is never touched — this makes it safe to run
// against the shared dev project even after real data exists.
export async function cleanup() {
  const admin = adminClient();

  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const testUserIds = (usersPage?.users ?? [])
    .filter((u) => isTestEmail(u.email))
    .map((u) => u.id);

  if (testUserIds.length === 0) return;

  // Delete groups created by test users first (cascades their memberships).
  await admin.from("groups").delete().in("created_by", testUserIds);

  // Delete the test users themselves (cascades their profiles + memberships).
  for (const id of testUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
}
