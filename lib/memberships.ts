import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import type { Role, MembershipStatus } from "@/lib/constants";

export type CurrentMembership = {
  userId: string;
  groupId: string;
  groupName: string;
  role: Role;
  status: MembershipStatus;
};

export async function requireCurrentMembership(): Promise<CurrentMembership> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("group_id, role, status, groups(name)")
    .eq("user_id", user.id)
    .in("status", ["active", "pending"])
    .order("approved_at", { ascending: false })
    .maybeSingle();

  if (!membership) redirect("/join");
  if (membership.status === "pending") redirect("/pending");

  return {
    userId: user.id,
    groupId: membership.group_id,
    groupName: (membership.groups as unknown as { name: string }).name,
    role: membership.role,
    status: membership.status,
  };
}
