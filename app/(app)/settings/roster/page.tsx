import Link from "next/link";
import { loadRoster } from "@/lib/students";
import { requireCurrentMembership } from "@/lib/memberships";
import { Icon } from "@/components/icon";
import { PromoteButton } from "@/components/promote-button";

// 성별 색점: 여=핑크, 남=하늘, 미입력=중립(테두리만). 배정 목록과 동일.
function genderDot(gender: string | null): string {
  return gender === "female"
    ? "bg-pink-400"
    : gender === "male"
      ? "bg-sky-400"
      : "bg-transparent border border-border";
}

export default async function RosterPage() {
  const { canEdit, classes, students } = await loadRoster();
  const m = await requireCurrentMembership();
  const isMaster = m.role === "master";
  const classMap = new Map(classes.map((c) => [c.id, c]));
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
      sort = cls.displayOrder;
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
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-ink">학적부</h1>
          {canEdit && (
            <span className="flex items-center gap-2">
              {isMaster && <PromoteButton />}
              <Link
                href="/settings/roster/new"
                className="rounded-btn bg-sage px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sage-deep"
              >
                + 학생 추가
              </Link>
            </span>
          )}
        </div>

        <div className="mt-3 flex gap-2 text-xs">
          {canEdit && (
            <Link
              href="/settings/roster/classes"
              className="rounded-tag bg-white px-3 py-1 text-ink-muted shadow-sm hover:text-ink"
            >
              반 관리
            </Link>
          )}
          <Link
            href="/settings/roster/hidden"
            className="rounded-tag bg-white px-3 py-1 text-ink-muted shadow-sm hover:text-ink"
          >
            숨김 학생
          </Link>
          <Link
            href="/settings/roster/graduated"
            className="rounded-tag bg-white px-3 py-1 text-ink-muted shadow-sm hover:text-ink"
          >
            졸업생
          </Link>
        </div>

        {sections.length === 0 ? (
          <p className="mt-12 text-center text-ink-muted">
            아직 등록된 학생이 없어요 🐑
          </p>
        ) : (
          sections.map((sec) => (
            <section key={sec.label} className="mt-7">
              <h2 className="mb-2 text-sm font-bold text-ink-muted">
                {sec.label} ({sec.items.length})
              </h2>
              <ul className="space-y-2">
                {sec.items.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/settings/roster/${s.id}`}
                      className="flex items-center gap-3 rounded-card border border-border/60 bg-white p-3 shadow-sm transition hover:shadow-md"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-soft text-lg">
                        🐑
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-medium text-ink">
                          <span
                            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${genderDot(s.gender)}`}
                          />
                          {s.name}
                          {s.birthdayMonth === currentMonth && (
                            <Icon name="star" size={14} alt="이번 달 생일" />
                          )}
                        </span>
                        {(s.grade || s.school) && (
                          <span className="block text-xs text-ink-muted">
                            {[s.grade ? `${s.grade}학년` : null, s.school]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                        {s.phoneSelf && (
                          <span className="block text-xs text-ink-muted">
                            {s.phoneSelf}
                          </span>
                        )}
                      </span>
                      <span className="ml-auto text-lg text-ink-muted">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
