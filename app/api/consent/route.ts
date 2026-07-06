import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL!));

  await supabase
    .from("profiles")
    .update({ privacy_consent_at: new Date().toISOString() })
    .eq("id", user.id);

  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL!));
}
