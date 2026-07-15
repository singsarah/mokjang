import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanup, createTestUser } from "./setup";

// 교사 출타 RLS — 마이그레이션 20260715000001.
//   * 조회: 활성 멤버 누구나
//   * 쓰기: 본인(teachers.user_id 연결 계정 — viewer 포함) 또는 마스터
//   * group_id는 교사의 실제 그룹과 일치해야 함 (트리거)
//   * start_date <= end_date (CHECK)
// 인증 rate limit 부담을 줄이기 위해 그룹 2개를 beforeAll에서 한 번만 만들어
// 세 테스트가 공유한다 (파일 내 테스트는 순차 실행).

async function setupGroup(code: string) {
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
  // 명단: editor/viewer는 계정 연결, TeacherC는 계정 없음.
  const { data: teachers } = await admin
    .from("teachers")
    .insert([
      { group_id: group!.id, name: "TeacherE", user_id: editor.userId },
      { group_id: group!.id, name: "TeacherV", user_id: viewer.userId },
      { group_id: group!.id, name: "TeacherC" },
    ])
    .select("id, name");
  const byName = new Map(teachers!.map((t) => [t.name, t.id]));
  return {
    group: group!,
    master,
    editor,
    viewer,
    teacherE: byName.get("TeacherE")!,
    teacherV: byName.get("TeacherV")!,
    teacherC: byName.get("TeacherC")!,
  };
}

type Ctx = Awaited<ReturnType<typeof setupGroup>>;
let ctxA: Ctx;
let ctxB: Ctx;

describe("RLS: teacher absences", () => {
  beforeAll(async () => {
    await cleanup();
    ctxA = await setupGroup("TABS0001");
    ctxB = await setupGroup("TABS0002");
  });
  afterAll(cleanup);

  it("self can write own absence (viewer included); others' are rejected", async () => {
    const asEditor = anonClient(ctxA.editor.accessToken);
    const asViewer = anonClient(ctxA.viewer.accessToken);
    const admin = adminClient();

    // 편집자: 본인 출타 INSERT — 허용 (이 행은 뒤 테스트에서도 남아 있음)
    const { data: eIns, error: eErr } = await asEditor
      .from("teacher_absences")
      .insert({
        group_id: ctxA.group.id, teacher_id: ctxA.teacherE,
        start_date: "2026-07-20", end_date: "2026-07-22", reason: "trip",
        created_by: ctxA.editor.userId,
      })
      .select("id").single();
    expect(eErr).toBeNull();

    // 뷰어(viewer!): 본인 출타 INSERT/UPDATE/DELETE 전부 허용
    const { data: vIns, error: vErr } = await asViewer
      .from("teacher_absences")
      .insert({
        group_id: ctxA.group.id, teacher_id: ctxA.teacherV,
        start_date: "2026-07-19", end_date: "2026-07-19",
      })
      .select("id").single();
    expect(vErr).toBeNull();
    const { data: vUpd } = await asViewer
      .from("teacher_absences")
      .update({ end_date: "2026-07-20" }).eq("id", vIns!.id).select("id");
    expect(vUpd).toHaveLength(1);
    const { data: vDel } = await asViewer
      .from("teacher_absences").delete().eq("id", vIns!.id).select("id");
    expect(vDel).toHaveLength(1);

    // 편집자: 계정 없는 교사(TeacherC) 출타 INSERT — RLS 거부
    const { error: othersErr } = await asEditor
      .from("teacher_absences")
      .insert({
        group_id: ctxA.group.id, teacher_id: ctxA.teacherC,
        start_date: "2026-07-20", end_date: "2026-07-21",
      });
    expect(othersErr).not.toBeNull();

    // 뷰어: 편집자 출타 UPDATE — 0행 매치, 원본 불변
    await asViewer
      .from("teacher_absences").update({ reason: "hacked" }).eq("id", eIns!.id);
    const { data: unchanged } = await admin
      .from("teacher_absences").select("reason").eq("id", eIns!.id).single();
    expect(unchanged!.reason).toBe("trip");

    // 본인 행의 teacher_id를 타인으로 재배정 — WITH CHECK 위반 (에러 또는 0행)
    const { data: reassigned, error: reassignErr } = await asEditor
      .from("teacher_absences")
      .update({ teacher_id: ctxA.teacherC }).eq("id", eIns!.id).select("id");
    expect(reassignErr !== null || reassigned!.length === 0).toBe(true);
    const { data: stillE } = await admin
      .from("teacher_absences").select("teacher_id").eq("id", eIns!.id).single();
    expect(stillE!.teacher_id).toBe(ctxA.teacherE);
  });

  it("master can manage anyone's absence, incl. unlinked teachers", async () => {
    const asMaster = anonClient(ctxA.master.accessToken);

    // 계정 없는 교사 대신 등록
    const { data: cIns, error: cErr } = await asMaster
      .from("teacher_absences")
      .insert({
        group_id: ctxA.group.id, teacher_id: ctxA.teacherC,
        start_date: "2026-08-01", end_date: "2026-08-05",
        created_by: ctxA.master.userId,
      })
      .select("id").single();
    expect(cErr).toBeNull();

    // 다른 교사 출타 수정·삭제 (삭제까지 해서 그룹 상태는 원위치)
    const { data: upd, error: updErr } = await asMaster
      .from("teacher_absences")
      .update({ reason: "biz" }).eq("id", cIns!.id).select("id");
    expect(updErr).toBeNull();
    expect(upd).toHaveLength(1);
    const { data: del } = await asMaster
      .from("teacher_absences").delete().eq("id", cIns!.id).select("id");
    expect(del).toHaveLength(1);
  });

  it("cross-group isolation and constraints", async () => {
    const asMasterB = anonClient(ctxB.master.accessToken);
    const asViewerA = anonClient(ctxA.viewer.accessToken);
    const admin = adminClient();

    // G_A에 출타 하나 추가 (테스트 1의 편집자 출타 1건 + 이 건 = 2건)
    await admin.from("teacher_absences").insert({
      group_id: ctxA.group.id, teacher_id: ctxA.teacherV,
      start_date: "2026-07-25", end_date: "2026-07-26",
    });

    // G_B 마스터가 G_A 교사를 자기 그룹 group_id로 INSERT — 트리거 예외
    const { error: injectErr } = await asMasterB
      .from("teacher_absences")
      .insert({
        group_id: ctxB.group.id, teacher_id: ctxA.teacherE,
        start_date: "2026-07-20", end_date: "2026-07-21",
      });
    expect(injectErr).not.toBeNull();

    // G_B 마스터가 G_A group_id로 INSERT — RLS 거부
    const { error: crossErr } = await asMasterB
      .from("teacher_absences")
      .insert({
        group_id: ctxA.group.id, teacher_id: ctxA.teacherE,
        start_date: "2026-07-20", end_date: "2026-07-21",
      });
    expect(crossErr).not.toBeNull();

    // G_B 멤버가 G_A 출타 SELECT — 0행
    const { data: crossRead } = await asMasterB
      .from("teacher_absences").select("id").eq("group_id", ctxA.group.id);
    expect(crossRead).toHaveLength(0);

    // 같은 그룹 뷰어는 전체 조회 가능 (테스트 1 잔여 1건 + 위 admin 1건)
    const { data: read } = await asViewerA
      .from("teacher_absences").select("id").eq("group_id", ctxA.group.id);
    expect(read).toHaveLength(2);

    // start_date > end_date — CHECK 위반
    const asMasterA = anonClient(ctxA.master.accessToken);
    const { error: rangeErr } = await asMasterA
      .from("teacher_absences")
      .insert({
        group_id: ctxA.group.id, teacher_id: ctxA.teacherE,
        start_date: "2026-07-22", end_date: "2026-07-20",
      });
    expect(rangeErr).not.toBeNull();

    // 명단 미연결 활성 멤버(G_B editor는 G_A에 링크 없음)가 G_A 교사로 INSERT — RLS 거부
    const { error: unlinkedErr } = await anonClient(ctxB.editor.accessToken)
      .from("teacher_absences")
      .insert({
        group_id: ctxA.group.id, teacher_id: ctxA.teacherC,
        start_date: "2026-07-20", end_date: "2026-07-21",
      });
    expect(unlinkedErr).not.toBeNull();
  });
});
