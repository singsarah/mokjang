import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

async function makeGroupWithRoles(joinCode: string) {
  const admin = adminClient();
  const master = await createTestUser();
  const editor = await createTestUser();
  const { data: group } = await admin
    .from("groups").insert({ name: "PROMO", join_code: joinCode, created_by: master.userId }).select("id").single();
  await admin.from("memberships").insert([
    { group_id: group!.id, user_id: master.userId, role: "master", status: "active" },
    { group_id: group!.id, user_id: editor.userId, role: "editor", status: "active" },
  ]);
  return { group: group!, master, editor };
}

describe("RLS/RPC: promotion", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("promote_group bumps grades, graduates 3, keeps null; blocks second run same year; master-only", async () => {
    const { group, master, editor } = await makeGroupWithRoles("PROMO001");
    const admin = adminClient();
    await admin.from("students").insert([
      { group_id: group.id, name: "일학년", grade: 1 },
      { group_id: group.id, name: "이학년", grade: 2 },
      { group_id: group.id, name: "삼학년", grade: 3 },
      { group_id: group.id, name: "무학년", grade: null },
    ]);

    // editor는 진급 불가
    const asEditor = anonClient(editor.accessToken);
    const { error: eErr } = await asEditor.rpc("promote_group", { p_group_id: group.id });
    expect(eErr).not.toBeNull();

    // master 진급
    const asMaster = anonClient(master.accessToken);
    const { error: pErr } = await asMaster.rpc("promote_group", { p_group_id: group.id });
    expect(pErr).toBeNull();

    const { data: rows } = await admin
      .from("students").select("name, grade, graduated_at").eq("group_id", group.id);
    const by = Object.fromEntries((rows ?? []).map((r) => [r.name, r]));
    expect(by["일학년"].grade).toBe(2);
    expect(by["이학년"].grade).toBe(3);
    expect(by["삼학년"].graduated_at).not.toBeNull();
    expect(by["무학년"].grade).toBeNull();

    // 같은 해 재실행 차단
    const { error: p2 } = await asMaster.rpc("promote_group", { p_group_id: group.id });
    expect(p2).not.toBeNull();
  });
});
