import Link from "next/link";
import { loadRoster } from "@/lib/students";
import { requireCurrentMembership } from "@/lib/memberships";
import { Icon } from "@/components/icon";
import { PromoteButton } from "@/components/promote-button";
import { StudentExportButton } from "@/components/student-export";
import { RosterList, type RosterListSection } from "@/components/roster-list";

export default async function RosterPage() {
  const { canEdit, classes, students } = await loadRoster();
  const m = await requireCurrentMembership();
  const isMaster = m.role === "master";
  const classMap = new Map(classes.map((c) => [c.id, c]));
  // classes는 이미 display_order → created_at 순으로 정렬돼 있음.
  // displayOrder 값 자체는 동률(구데이터 전부 0)일 수 있어 배열 순번을 정렬키로 쓴다.
  const classOrder = new Map(classes.map((c, i) => [c.id, i]));
  const currentMonth = new Date().getMonth() + 1; // 이번 달 생일 학생에 ⭐ 배지

  const groups = new Map<string, { label: string; sort: number; items: typeof students }>();
  for (const s of students) {
    const cls = s.classId ? classMap.get(s.classId) : null;
    // 반(이름) 섹션을 먼저(display_order 순), 그다음 반 없는 학생을 학년별로,
    // 학년도 없으면 "반 미배정"으로 묶는다.
    let key: string, label: string, sort: number;
    if (cls) {
      key = `c:${cls.id}`;
      label = cls.name;
      sort = classOrder.get(cls.id)!;
    } else if (s.grade != null) {
      key = `g:${s.grade}`;
      label = `${s.grade}학년 (반 없음)`;
      sort = 100000 + s.grade;
    } else {
      key = "none";
      label = "반 미배정";
      sort = 200000;
    }
    if (!groups.has(key)) groups.set(key, { label, sort, items: [] });
    groups.get(key)!.items.push(s);
  }
  const sections = [...groups.values()].sort((a, b) => a.sort - b.sort);

  return (
    <main className="min-h-screen bg-card pb-24">
      <div className="mx-auto max-w-md px-6 py-8">
        {/* 헤더도 아래 줄과 같은 4칸 그리드 — 업로드/다운로드가 숨김 학생/졸업생과 세로줄이 맞는다. */}
        <div className="grid grid-cols-4 items-center gap-2">
          <h1 className="col-span-2 font-display text-2xl font-bold text-ink">학적부</h1>
          {canEdit && (
            <>
              <Link
                href="/settings/roster/import"
                className="rounded-btn border border-transparent bg-sage-deep px-2 py-2 text-center text-sm font-medium text-white shadow-sm transition hover:bg-sage"
              >
                업로드
              </Link>
              <StudentExportButton />
            </>
          )}
        </div>

        {/* 하위 줄: + 추가 · ⬆️ 진급(master 전용) · 숨김 · 졸업생 — 네 개가 한 줄에 들어가게 짧은 라벨, 전부 동일 크기 */}
        <div
          className={`mt-3 grid gap-2 text-sm ${
            canEdit && isMaster ? "grid-cols-4" : canEdit ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          {canEdit && (
            <Link
              href="/settings/roster/new"
              className="rounded-tag border border-transparent bg-sage px-2 py-1.5 text-center font-medium text-white shadow-sm transition hover:bg-sage-deep"
            >
              + 추가
            </Link>
          )}
          {isMaster && <PromoteButton />}
          <Link
            href="/settings/roster/hidden"
            className="rounded-tag border border-transparent bg-white px-2 py-1.5 text-center text-ink-muted shadow-sm hover:text-ink"
          >
            숨김
          </Link>
          <Link
            href="/settings/roster/graduated"
            className="rounded-tag border border-transparent bg-white px-2 py-1.5 text-center text-ink-muted shadow-sm hover:text-ink"
          >
            졸업생
          </Link>
        </div>

        {sections.length === 0 ? (
          <p className="mt-12 flex items-center justify-center gap-1.5 text-ink-muted">
            아직 등록된 학생이 없어요
            <Icon name="sheep-face" size={18} alt="" />
          </p>
        ) : (
          <RosterList
            canEdit={canEdit}
            sections={sections.map(
              (sec): RosterListSection => ({
                label: `${sec.label} (${sec.items.length})`,
                items: sec.items.map((s) => ({
                  id: s.id,
                  name: s.name,
                  gender: s.gender,
                  meta: [s.grade ? `${s.grade}학년` : null, s.school, s.phoneSelf]
                    .filter(Boolean)
                    .join(" · "),
                  isBirthdayMonth: s.birthdayMonth === currentMonth,
                })),
              }),
            )}
          />
        )}
      </div>
    </main>
  );
}
