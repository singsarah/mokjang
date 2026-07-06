"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import {
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validation/auth";

export async function signUpEmailPassword(
  input: SignUpInput,
): Promise<{ error?: string }> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력을 확인해주세요" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.displayName } },
  });
  if (error || !data.user) return { error: error?.message ?? "가입 실패" };

  // Record consent (the profile row is created by a DB trigger; update it).
  await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      privacy_consent_at: new Date().toISOString(),
    })
    .eq("id", data.user.id);

  redirect("/join");
}

export async function signInEmailPassword(
  input: SignInInput,
): Promise<{ error?: string }> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { error: "입력을 확인해주세요" };

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "이메일 또는 비밀번호가 올바르지 않습니다" };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Bound directly as a <form action>, so it must resolve to void — on failure
// we redirect to the login page with an error flag rather than returning.
export async function signInWithGoogle(): Promise<void> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });
  if (error || !data.url) {
    redirect("/login?error=oauth");
  }
  redirect(data.url);
}
