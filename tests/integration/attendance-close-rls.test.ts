import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

// 출석 마감(closed_at) DB 가드 — 마이그레이션 20260710000001.
//   * 마감된 세션의 기록은 편집자도 변경 불가
//   * 마감 해제(closed_at 변경)는 마스터만
//   * 마감된 세션은 삭제 불가, 임시 세션은 삭제 가능

async function groupWithRoles(code: string) {
  const admin = adminClient();
  const master = await createTestUser();
  const editor = await createTestUser();
  const { data: group } = await admin
    .from("groups").insert({ name: "A", join_code: code, created_by: master.userId }).select("id").single();
  await admin.from("memberships").insert([
    { group_id: group!.id, user_id: master.userId, role: "master", status: "active" },
    { group_id: group!.id, user_id: editor.userId, role: "editor", status: "active" },
  ]);
  const { data: student } = await admin
    .from("students").insert({ group_id: group!.id, name: "Student", grade: 1 }).select("id").single();
  return { group: group!, master, editor, student: student! };
}

async function draftSessionWithRecord(
  ctx: Awaited<ReturnType<typeof groupWithRoles>>,
  date: string,
) {
  const asEditor = anonClient(ctx.editor.accessToken);
  const { data: session, error: sErr } = await asEditor
    .from("attendance_sessions")
    .insert({ group_id: ctx.group.id, session_date: date, note: "Sunday" })
    .select("id").single();
  expect(sErr).toBeNull();
  const { error: rErr } = await asEditor.from("attendance_records").insert({
    group_id: ctx.group.id, session_id: session!.id, student_id: ctx.student.id, status: "present",
  });
  expect(rErr).toBeNull();
  return session!.id;
}

describe("RLS: attendance close", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("editor can close; closed session locks records for everyone", async () => {
    const ctx = await groupWithRoles("ATTC0001");
    const sessionId = await draftSessionWithRecord(ctx, "2026-07-05");
    const asEditor = anonClient(ctx.editor.accessToken);

    // 편집자가 마감 (closed_at NULL → 값) — 허용
    const { error: closeErr } = await asEditor
      .from("attendance_sessions")
      .update({ closed_at: new Date().toISOString(), closed_by: ctx.editor.userId })
      .eq("id", sessionId);
    expect(closeErr).toBeNull();

    // 마감 후 기록 UPDATE/DELETE/INSERT 전부 차단 (트리거)
    const { error: updErr } = await asEditor
      .from("attendance_records").update({ status: "unconfirmed" }).eq("session_id", sessionId);
    expect(updErr).not.toBeNull();

    const { error: delErr } = await asEditor
      .from("attendance_records").delete().eq("session_id", sessionId);
    expect(delErr).not.toBeNull();

    const admin = adminClient();
    const { data: st2 } = await admin
      .from("students").insert({ group_id: ctx.group.id, name: "Student2", grade: 2 }).select("id").single();
    const { error: insErr } = await asEditor.from("attendance_records").insert({
      group_id: ctx.group.id, session_id: sessionId, student_id: st2!.id, status: "present",
    });
    expect(insErr).not.toBeNull();

    // 마스터도 마감 상태에선 기록 변경 불가 (해제 후에만)
    const asMaster = anonClient(ctx.master.accessToken);
    const { error: masterUpdErr } = await asMaster
      .from("attendance_records").update({ status: "unconfirmed" }).eq("session_id", sessionId);
    expect(masterUpdErr).not.toBeNull();

    const { data: after } = await admin
      .from("attendance_records").select("status").eq("session_id", sessionId);
    expect(after).toHaveLength(1);
    expect(after![0]!.status).toBe("present");
  });

  it("only master can reopen a closed session", async () => {
    const ctx = await groupWithRoles("ATTC0002");
    const sessionId = await draftSessionWithRecord(ctx, "2026-07-05");
    const asEditor = anonClient(ctx.editor.accessToken);
    const asMaster = anonClient(ctx.master.accessToken);

    await asEditor.from("attendance_sessions")
      .update({ closed_at: new Date().toISOString() }).eq("id", sessionId);

    // 편집자 해제 시도 → 트리거가 거부
    const { error: editorReopenErr } = await asEditor
      .from("attendance_sessions").update({ closed_at: null }).eq("id", sessionId);
    expect(editorReopenErr).not.toBeNull();

    // 마스터 해제 → 허용, 이후 편집자 기록 수정 다시 가능
    const { error: masterReopenErr } = await asMaster
      .from("attendance_sessions").update({ closed_at: null, closed_by: null }).eq("id", sessionId);
    expect(masterReopenErr).toBeNull();

    const { error: updErr } = await asEditor
      .from("attendance_records").update({ status: "unconfirmed" }).eq("session_id", sessionId);
    expect(updErr).toBeNull();
  });

  it("closed session cannot be deleted; draft session can", async () => {
    const ctx = await groupWithRoles("ATTC0003");
    const closedId = await draftSessionWithRecord(ctx, "2026-07-05");
    const draftId = await draftSessionWithRecord(ctx, "2026-07-12");
    const asEditor = anonClient(ctx.editor.accessToken);
    const asMaster = anonClient(ctx.master.accessToken);
    const admin = adminClient();

    await asEditor.from("attendance_sessions")
      .update({ closed_at: new Date().toISOString() }).eq("id", closedId);

    // 마감 세션 삭제 → 편집자/마스터 모두 거부 (해제 후에만 삭제 가능)
    const { error: eDelErr } = await asEditor
      .from("attendance_sessions").delete().eq("id", closedId);
    expect(eDelErr).not.toBeNull();
    const { error: mDelErr } = await asMaster
      .from("attendance_sessions").delete().eq("id", closedId);
    expect(mDelErr).not.toBeNull();
    const { data: stillThere } = await admin
      .from("attendance_sessions").select("id").eq("id", closedId).maybeSingle();
    expect(stillThere).not.toBeNull();

    // 임시 세션은 편집자가 삭제 가능 (기록도 CASCADE로 함께 삭제)
    const { error: draftDelErr } = await asEditor
      .from("attendance_sessions").delete().eq("id", draftId);
    expect(draftDelErr).toBeNull();
    const { data: gone } = await admin
      .from("attendance_sessions").select("id").eq("id", draftId).maybeSingle();
    expect(gone).toBeNull();
  });
});
