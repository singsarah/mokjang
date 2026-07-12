import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

async function groupWithRoles(code: string) {
  const admin = adminClient();
  const master = await createTestUser();
  const editor = await createTestUser();
  const viewer = await createTestUser();
  const { data: group } = await admin
    .from("groups").insert({ name: "A", join_code: code, created_by: master.userId }).select("id").single();
  await admin.from("memberships").insert([
    { group_id: group!.id, user_id: master.userId, role: "master", status: "active" },
    { group_id: group!.id, user_id: editor.userId, role: "editor", status: "active" },
    { group_id: group!.id, user_id: viewer.userId, role: "viewer", status: "active" },
  ]);
  return { group: group!, master, editor, viewer };
}

describe("RLS: meeting minutes", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("editor can create and update; viewer can read", async () => {
    const { group, editor, viewer } = await groupWithRoles("MIN00001");
    const asEditor = anonClient(editor.accessToken);
    const { data: minute, error: cErr } = await asEditor
      .from("meeting_minutes")
      .insert({ group_id: group.id, title: "meeting 1", meeting_date: "2026-07-12", content: "agenda" })
      .select("id").single();
    expect(cErr).toBeNull();

    const { error: uErr } = await asEditor
      .from("meeting_minutes")
      .update({ content: "agenda v2" })
      .eq("id", minute!.id);
    expect(uErr).toBeNull();

    const asViewer = anonClient(viewer.accessToken);
    const { data: seen } = await asViewer.from("meeting_minutes").select("id, content");
    expect(seen?.length).toBe(1);
    expect(seen?.[0]?.content).toBe("agenda v2");
  });

  it("viewer cannot write", async () => {
    const { group, editor, viewer } = await groupWithRoles("MIN00002");
    const asEditor = anonClient(editor.accessToken);
    const { data: minute } = await asEditor
      .from("meeting_minutes")
      .insert({ group_id: group.id, title: "meeting 2", meeting_date: "2026-07-12", content: "original" })
      .select("id").single();

    const asViewer = anonClient(viewer.accessToken);
    const { error: insErr } = await asViewer
      .from("meeting_minutes")
      .insert({ group_id: group.id, title: "hacked", meeting_date: "2026-07-12" });
    expect(insErr).not.toBeNull();

    // update/delete는 에러 대신 0건 매칭될 수 있으므로 실제 데이터로 검증
    await asViewer.from("meeting_minutes").update({ content: "tampered" }).eq("id", minute!.id);
    await asViewer.from("meeting_minutes").delete().eq("id", minute!.id);
    const admin = adminClient();
    const { data: after } = await admin
      .from("meeting_minutes").select("content").eq("id", minute!.id).single();
    expect(after?.content).toBe("original");
  });

  it("other group cannot read minutes", async () => {
    const a = await groupWithRoles("MIN00003");
    const b = await groupWithRoles("MIN00004");
    const admin = adminClient();
    const { error } = await admin
      .from("meeting_minutes")
      .insert({ group_id: a.group.id, title: "secret", meeting_date: "2026-07-12" });
    expect(error).toBeNull();
    const asB = anonClient(b.master.accessToken);
    const { data: seen } = await asB.from("meeting_minutes").select("id");
    expect(seen ?? []).toEqual([]);
  });
});
