"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { generateJoinCode } from "@/lib/join-code";
import { isDemoEmail } from "@/lib/demo";

const createGroupSchema = z.object({
  name: z.string().min(1, "그룹 이름을 입력해주세요").max(100),
});

export async function createGroup(
  input: z.infer<typeof createGroupSchema>,
): Promise<{ error?: string }> {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  // Retry on join-code collision (extremely unlikely but defensible)
  let attempt = 0;
  while (attempt < 5) {
    const joinCode = generateJoinCode();
    const { data: group, error: groupErr } = await supabase
      .from("groups")
      .insert({
        name: parsed.data.name.trim(),
        join_code: joinCode,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (groupErr) {
      if (groupErr.code === "23505") {
        attempt++;
        continue;
      }
      return { error: groupErr.message };
    }

    // Master membership (self-insert allowed by RLS because created_by = auth.uid())
    const { error: memErr } = await supabase.from("memberships").insert({
      group_id: group.id,
      user_id: user.id,
      role: "master",
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    });
    if (memErr) return { error: memErr.message };

    redirect("/settings/group");
  }
  return { error: "그룹 코드 발급에 실패했습니다. 다시 시도해주세요." };
}

const joinGroupSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8}$/, "8자리 영문+숫자 코드입니다"),
});

export async function joinGroup(
  input: z.infer<typeof joinGroupSchema>,
): Promise<{ error?: string }> {
  const parsed = joinGroupSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };

  // 체험 계정은 48시간 뒤 삭제되는 일회용이라 실제 그룹 참여를 막는다.
  // (승인돼도 본인이 다시 로그인할 수 없는 유령 교사가 됨)
  if (isDemoEmail(user.email)) {
    return {
      error:
        "체험 계정으로는 그룹에 참여할 수 없어요. 로그아웃 후 실제 계정으로 가입하고 초대 링크를 다시 열어주세요.",
    };
  }

  // Look up the group by code (RLS: no policy for anonymous select — we allow
  // matching a code only via the RPC below, which runs as SECURITY DEFINER).
  const { data: group, error: lookupErr } = await supabase.rpc(
    "find_group_by_code",
    { code_input: parsed.data.code },
  );
  if (lookupErr || !group) return { error: "코드를 찾을 수 없습니다" };

  // Check if user already has any membership with this group
  const { data: existing } = await supabase
    .from("memberships")
    .select("status")
    .eq("group_id", group)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.status === "active") {
    redirect("/");
  }
  if (existing?.status === "pending") {
    redirect("/pending");
  }
  // 'removed' → allow re-request (fall through)

  const { error: insertErr } = await supabase.from("memberships").insert({
    group_id: group,
    user_id: user.id,
    role: "viewer", // placeholder; master sets real role on approval
    status: "pending",
  });
  if (insertErr) return { error: insertErr.message };

  // 초대 링크가 남긴 코드 쿠키는 참여를 마쳤으니 정리한다.
  (await cookies()).delete("pending_join_code");
  redirect("/pending");
}
