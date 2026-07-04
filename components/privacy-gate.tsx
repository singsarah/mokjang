import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export async function PrivacyGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("privacy_consent_at")
    .eq("id", user.id)
    .single();

  if (!profile?.privacy_consent_at) {
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="rounded-lg bg-white p-6 shadow">
          <h1 className="text-xl font-semibold">개인정보 동의 필요</h1>
          <p className="mt-3 text-sm text-gray-700">
            서비스를 계속 이용하려면{" "}
            <Link href="/privacy" className="text-pasture-600 underline">
              개인정보 처리 방침
            </Link>
            에 동의해주세요.
          </p>
          <form action="/api/consent" method="post" className="mt-6">
            <button
              type="submit"
              className="w-full rounded-lg bg-pasture-500 py-3 text-white hover:bg-pasture-600"
            >
              동의합니다
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
