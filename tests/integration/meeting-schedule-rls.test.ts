import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

// 조직 관리(모임 일정) RLS — 마이그레이션 20260713000001.
//   * groups.meeting_days 변경은 마스터만 (기존 groups UPDATE 정책)
//   * meeting_days 는 0~6만 허용 (CHECK)
//   * extra_meetings: 조회는 활성 멤버, 추가/삭제는 마스터만

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
  return { group: group!, master, editor };
}

describe("RLS: meeting schedule", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("master can set meeting_days; editor cannot; invalid weekday rejected", async () => {
    const ctx = await groupWithRoles("MTGS0001");
    const asMaster = anonClient(ctx.master.accessToken);
    const asEditor = anonClient(ctx.editor.accessToken);
    const admin = adminClient();

    // 마스터: 일+수 설정 → 저장됨
    const { error: masterErr } = await asMaster
      .from("groups").update({ meeting_days: [0, 3] }).eq("id", ctx.group.id);
    expect(masterErr).toBeNull();
    const { data: after } = await admin
      .from("groups").select("meeting_days").eq("id", ctx.group.id).single();
    expect(after!.meeting_days).toEqual([0, 3]);

    // 편집자: RLS로 0행 매치 → 값이 그대로
    await asEditor.from("groups").update({ meeting_days: [5] }).eq("id", ctx.group.id);
    const { data: unchanged } = await admin
      .from("groups").select("meeting_days").eq("id", ctx.group.id).single();
    expect(unchanged!.meeting_days).toEqual([0, 3]);

    // 0~6 밖의 값은 CHECK 위반
    const { error: badErr } = await asMaster
      .from("groups").update({ meeting_days: [7] }).eq("id", ctx.group.id);
    expect(badErr).not.toBeNull();
  });

  it("extra_meetings: members read, only master writes", async () => {
    const ctx = await groupWithRoles("MTGS0002");
    const asMaster = anonClient(ctx.master.accessToken);
    const asEditor = anonClient(ctx.editor.accessToken);
    const admin = adminClient();

    // 마스터 추가 — 허용
    const { error: insErr } = await asMaster
      .from("extra_meetings")
      .insert({ group_id: ctx.group.id, meeting_date: "2026-07-15", created_by: ctx.master.userId });
    expect(insErr).toBeNull();

    // 같은 날짜 중복 추가 — PK 위반
    const { error: dupErr } = await asMaster
      .from("extra_meetings")
      .insert({ group_id: ctx.group.id, meeting_date: "2026-07-15" });
    expect(dupErr).not.toBeNull();
    expect(dupErr!.code).toBe("23505");

    // 편집자 추가 — RLS 거부
    const { error: editorInsErr } = await asEditor
      .from("extra_meetings")
      .insert({ group_id: ctx.group.id, meeting_date: "2026-07-16" });
    expect(editorInsErr).not.toBeNull();

    // 편집자 조회 — 허용 (출석 화면 날짜 계산에 필요)
    const { data: readByEditor } = await asEditor
      .from("extra_meetings").select("meeting_date").eq("group_id", ctx.group.id);
    expect(readByEditor).toHaveLength(1);
    expect(readByEditor![0]!.meeting_date).toBe("2026-07-15");

    // 편집자 삭제 — 0행 매치, 행이 남아 있음
    await asEditor.from("extra_meetings").delete()
      .eq("group_id", ctx.group.id).eq("meeting_date", "2026-07-15");
    const { data: still } = await admin
      .from("extra_meetings").select("meeting_date").eq("group_id", ctx.group.id);
    expect(still).toHaveLength(1);

    // 마스터 삭제 — 허용
    const { error: delErr } = await asMaster.from("extra_meetings").delete()
      .eq("group_id", ctx.group.id).eq("meeting_date", "2026-07-15");
    expect(delErr).toBeNull();
    const { data: gone } = await admin
      .from("extra_meetings").select("meeting_date").eq("group_id", ctx.group.id);
    expect(gone).toHaveLength(0);
  });
});
