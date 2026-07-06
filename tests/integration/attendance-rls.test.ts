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
  const { data: student } = await admin
    .from("students").insert({ group_id: group!.id, name: "학생", grade: 1 }).select("id").single();
  return { group: group!, master, editor, viewer, student: student! };
}

describe("RLS: attendance", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("editor can create session + record; viewer cannot write", async () => {
    const { group, editor, viewer, student } = await groupWithRoles("ATT00001");
    const asEditor = anonClient(editor.accessToken);
    const { data: session, error: sErr } = await asEditor
      .from("attendance_sessions")
      .insert({ group_id: group.id, session_date: "2026-07-06", note: "주일예배" })
      .select("id").single();
    expect(sErr).toBeNull();
    const { error: rErr } = await asEditor.from("attendance_records").insert({
      group_id: group.id, session_id: session!.id, student_id: student.id, status: "present",
    });
    expect(rErr).toBeNull();

    // viewer write blocked
    const asViewer = anonClient(viewer.accessToken);
    await asViewer.from("attendance_records").update({ status: "unconfirmed" }).eq("session_id", session!.id);
    const admin = adminClient();
    const { data: after } = await admin.from("attendance_records").select("status").eq("session_id", session!.id).single();
    expect(after?.status).toBe("present"); // viewer update had no effect
  });

  it("other group cannot read sessions", async () => {
    const a = await groupWithRoles("ATT00002");
    const b = await groupWithRoles("ATT00003");
    const admin = adminClient();
    await admin.from("attendance_sessions").insert({ group_id: a.group.id, session_date: "2026-07-06" });
    const asB = anonClient(b.master.accessToken);
    const { data: seen } = await asB.from("attendance_sessions").select("id");
    expect(seen ?? []).toEqual([]);
  });
});
