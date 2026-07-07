import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

async function makeGroupWithRoles(joinCode: string) {
  const admin = adminClient();
  const master = await createTestUser();
  const editor = await createTestUser();
  const viewer = await createTestUser();
  const { data: group } = await admin
    .from("groups")
    .insert({ name: "CA", join_code: joinCode, created_by: master.userId })
    .select("id")
    .single();
  await admin.from("memberships").insert([
    { group_id: group!.id, user_id: master.userId, role: "master", status: "active" },
    { group_id: group!.id, user_id: editor.userId, role: "editor", status: "active" },
    { group_id: group!.id, user_id: viewer.userId, role: "viewer", status: "active" },
  ]);
  return { group: group!, master, editor, viewer };
}

describe("RLS: class assignment / update", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("editor can move students into a class and unassign them; group-scoped", async () => {
    const { group, editor } = await makeGroupWithRoles("CASN0001");
    const admin = adminClient();
    const asEditor = anonClient(editor.accessToken);
    const { data: cls } = await asEditor
      .from("classes").insert({ group_id: group.id, name: "믿음반" }).select("id").single();
    const { data: s1 } = await asEditor
      .from("students").insert({ group_id: group.id, name: "학생1" }).select("id").single();
    const { data: s2 } = await asEditor
      .from("students").insert({ group_id: group.id, name: "학생2" }).select("id").single();

    // 배정(추가)
    const { error: e1 } = await asEditor
      .from("students").update({ class_id: cls!.id }).in("id", [s1!.id, s2!.id]).eq("group_id", group.id);
    expect(e1).toBeNull();
    const { data: after1 } = await admin
      .from("students").select("id, class_id").in("id", [s1!.id, s2!.id]);
    expect(after1!.every((r) => r.class_id === cls!.id)).toBe(true);

    // 빼기(미배정)
    await asEditor.from("students").update({ class_id: null }).eq("id", s1!.id).eq("group_id", group.id);
    const { data: after2 } = await admin.from("students").select("class_id").eq("id", s1!.id).single();
    expect(after2!.class_id).toBeNull();
  });

  it("viewer cannot reassign a student", async () => {
    const { group, editor, viewer } = await makeGroupWithRoles("CASN0002");
    const asEditor = anonClient(editor.accessToken);
    const { data: cls } = await asEditor
      .from("classes").insert({ group_id: group.id, name: "소망반" }).select("id").single();
    const { data: st } = await asEditor
      .from("students").insert({ group_id: group.id, name: "뷰어차단" }).select("id").single();

    const asViewer = anonClient(viewer.accessToken);
    await asViewer.from("students").update({ class_id: cls!.id }).eq("id", st!.id).eq("group_id", group.id);
    const admin = adminClient();
    const { data: after } = await admin.from("students").select("class_id").eq("id", st!.id).single();
    expect(after!.class_id).toBeNull(); // viewer update had no effect
  });

  it("cannot move another group's student", async () => {
    const a = await makeGroupWithRoles("CASN0003");
    const b = await makeGroupWithRoles("CASN0004");
    const admin = adminClient();
    const { data: clsA } = await admin
      .from("classes").insert({ group_id: a.group.id, name: "A반" }).select("id").single();
    const { data: stB } = await admin
      .from("students").insert({ group_id: b.group.id, name: "B학생" }).select("id").single();

    // a의 editor가 b의 학생을 자기 반으로 끌어오려 시도 → 그룹 스코프로 무효
    const asEditorA = anonClient(a.editor.accessToken);
    await asEditorA.from("students").update({ class_id: clsA!.id }).eq("id", stB!.id).eq("group_id", a.group.id);
    const { data: after } = await admin.from("students").select("class_id").eq("id", stB!.id).single();
    expect(after!.class_id).toBeNull(); // unchanged — belongs to group b
  });
});
