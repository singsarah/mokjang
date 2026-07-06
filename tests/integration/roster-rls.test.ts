import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

async function makeGroupWithRoles(joinCode: string) {
  const admin = adminClient();
  const master = await createTestUser();
  const editor = await createTestUser();
  const viewer = await createTestUser();
  const { data: group } = await admin
    .from("groups")
    .insert({ name: "R", join_code: joinCode, created_by: master.userId })
    .select("id")
    .single();
  await admin.from("memberships").insert([
    { group_id: group!.id, user_id: master.userId, role: "master", status: "active" },
    { group_id: group!.id, user_id: editor.userId, role: "editor", status: "active" },
    { group_id: group!.id, user_id: viewer.userId, role: "viewer", status: "active" },
  ]);
  return { group: group!, master, editor, viewer };
}

describe("RLS: students / classes", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("editor can insert a student; viewer cannot", async () => {
    const { group, editor, viewer } = await makeGroupWithRoles("ROST0001");
    const asEditor = anonClient(editor.accessToken);
    const { data: inserted, error: eErr } = await asEditor
      .from("students")
      .insert({ group_id: group.id, name: "홍길동", grade: 1 })
      .select("id")
      .single();
    expect(eErr).toBeNull();
    expect(inserted?.id).toBeTruthy();

    const asViewer = anonClient(viewer.accessToken);
    await asViewer.from("students").insert({ group_id: group.id, name: "차단", grade: 1 });
    const admin = adminClient();
    const { data: rows } = await admin.from("students").select("name").eq("group_id", group.id);
    expect(rows?.map((r) => r.name).sort()).toEqual(["홍길동"]);
  });

  it("viewer can read students; other group cannot", async () => {
    const a = await makeGroupWithRoles("ROST0002");
    const b = await makeGroupWithRoles("ROST0003");
    const admin = adminClient();
    await admin.from("students").insert({ group_id: a.group.id, name: "A학생", grade: 2 });

    const asViewerA = anonClient(a.viewer.accessToken);
    const { data: seenByA } = await asViewerA.from("students").select("name");
    expect(seenByA?.map((r) => r.name)).toContain("A학생");

    const asMasterB = anonClient(b.master.accessToken);
    const { data: seenByB } = await asMasterB.from("students").select("name");
    expect(seenByB ?? []).toEqual([]);
  });
});
