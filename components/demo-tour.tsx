"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

// 체험 모드 단계 안내 카드 — 현재 화면을 인식해서
//   * 아직 해당 화면이 아니면: 가는 길 안내 + 아래 탭바에 👇 강조
//   * 도착하면: 그 화면에서 할 수 있는 일을 자세히 설명
// 진행 단계는 localStorage에 저장(새로고침·페이지 이동에도 유지).

type Step = {
  title: string;
  target?: string; // 이 경로(prefix)에 있으면 "도착"
  tab?: number; // 이동 안내 중 강조할 탭 (0출석 1일정 2대시보드 3설정)
  // 도착 전 안내 — 위에서부터 현재 경로에 첫 매칭되는 문구 사용
  directions?: { match: (p: string) => boolean; text: string }[];
  arrived: string; // 도착(또는 target 없음) 시 설명
};

const anywhere = () => true;

const STEPS: Step[] = [
  {
    title: "체험 모드에 오신 걸 환영해요",
    arrived:
      "여기는 Dummy 교사·학생·일정이 미리 담긴 연습 공간이에요. 마음껏 눌러보고 바꿔도 실제 데이터에는 아무 영향이 없어요. [다음]을 누르면 순서대로 안내해 드릴게요.",
  },
  {
    title: "1단계 · 교사 관리",
    target: "/settings/teachers",
    tab: 3,
    directions: [
      { match: (p) => p.startsWith("/settings"), text: "설정 메뉴에서 '교사 관리'를 누르세요." },
      { match: anywhere, text: "아래 ⚙️ 설정 탭을 누른 뒤 '교사 관리'를 선택하세요." },
    ],
    arrived:
      "여기가 교사 관리 화면이에요. 아래 '교사 명단'에 체험용 교사 6명이 있어요 — 실제로는 '엑셀 업로드'로 한 번에 올리거나 '+ 교사 추가'로 한 명씩 등록해요. 위쪽 '활성 교사'에서는 가입 신청한 교사를 승인하고 권한(마스터/편집/조회)을 정하고, 명단과 계정을 연결해요.",
  },
  {
    title: "2단계 · 학적부 (학생 명단)",
    target: "/settings/roster",
    tab: 3,
    directions: [
      { match: (p) => p.startsWith("/settings"), text: "설정 메뉴에서 '학적부'를 누르세요." },
      { match: anywhere, text: "아래 ⚙️ 설정 탭을 누른 뒤 '학적부'를 선택하세요." },
    ],
    arrived:
      "학생 12명이 등록돼 있어요. 학생 이름을 누르면 상세 정보(연락처·보호자·생일·학교·메모)를 보고 수정할 수 있어요. 실제 등록은 '엑셀 업로드'로 한 번에 — 다운로드로 백업도 돼요. 다 봤으면 [다음]으로 반 관리를 볼게요.",
  },
  {
    title: "3단계 · 반 관리 (반 배정)",
    target: "/settings/roster/classes",
    tab: 3,
    directions: [
      { match: anywhere, text: "아래 ⚙️ 설정 탭 → '반 관리'를 선택하세요." },
    ],
    arrived:
      "1반·2반·3반이 담임 선생님과 함께 만들어져 있어요. 반을 누르면 학생을 추가하거나 뺄 수 있고, 학년 필터로 골라서 배정할 수 있어요. 새 학기에 '+ 반 만들기'로 반을 추가하면 돼요.",
  },
  {
    title: "4단계 · 출석 체크",
    target: "/attendance",
    tab: 0,
    directions: [{ match: anywhere, text: "아래 왼쪽 🐑 출석 탭을 누르세요." }],
    arrived:
      "위에서 반 탭을 고르고, 학생(양)을 탭하면 초록색 = 출석! 한 번 더 탭하면 취소돼요. 결석한 학생은 이름 아래 사유 칸에 이유를 적어요 — 비워 두면 빨간색(연락필요)이 돼요. 다 체크했으면 아래 [출석 마감하기]까지! 마감해야 통계와 엑셀에 들어가요. 날짜 옆 ◀▶로 지난 주 기록도 볼 수 있어요.",
  },
  {
    title: "5단계 · 달력 (일정)",
    target: "/calendar",
    tab: 1,
    directions: [{ match: anywhere, text: "아래 📅 일정 탭을 누르세요." }],
    arrived:
      "이번 달 일정(주일예배·교사 회의·수련회)과 학생·교사 생일 🎂이 보여요. 날짜 칸을 탭하면 그 날의 일정이 팝업으로 떠요. '+ 일정 추가'로 직접 등록하거나, '일정 가져오기'에서 엑셀 파일은 물론 주보 사진(이미지)·PDF를 올려도 AI가 일정을 읽어 한 번에 등록해 줘요. (체험 모드에서는 엑셀 템플릿만 가능해요)",
  },
  {
    title: "6단계 · 대시보드 (통계)",
    target: "/dashboard",
    tab: 2,
    directions: [{ match: anywhere, text: "아래 📊 대시보드 탭을 누르세요." }],
    arrived:
      "지난 예배 출석 요약이 보여요 — 출석/사유결석/미확인 숫자를 탭하면 명단이 펼쳐져요. 제목 옆 ◀▶로 지난 주 기록을 넘겨 보세요. 아래로 내리면 출석 추이 그래프, 연락이 필요한 학생(전화 바로 걸기), 이번 달 생일이 있어요. 출석부 전체 엑셀 다운로드도 여기서!",
  },
  {
    title: "둘러보기 끝!",
    arrived:
      "실제로 쓰려면 체험을 종료하고 가입해서 우리 고등부 그룹을 만들면 돼요. 이 체험 공간은 이틀 뒤 자동으로 사라져요.",
  },
];

const STORAGE_KEY = "mokjang-demo-tour-step";

export function DemoTour() {
  const pathname = usePathname();
  const [step, setStep] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(STORAGE_KEY) ?? "0");
    if (saved >= 0 && saved < STEPS.length) setStep(saved);
    setLoaded(true);
  }, []);

  function go(next: number) {
    setStep(next);
    window.localStorage.setItem(STORAGE_KEY, String(next));
  }

  function endDemo() {
    window.localStorage.removeItem(STORAGE_KEY);
    startTransition(async () => {
      await signOut();
    });
  }

  if (!loaded) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-24 right-4 z-40 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white shadow-lg"
      >
        🐑 체험 가이드
      </button>
    );
  }

  const s = STEPS[step]!;
  const last = step === STEPS.length - 1;
  const arrived = !s.target || pathname.startsWith(s.target);
  const direction = arrived
    ? null
    : (s.directions?.find((d) => d.match(pathname))?.text ?? null);

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 flex flex-col px-4 pb-1">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-white p-4 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display font-bold text-ink">🐑 {s.title}</p>
          <button
            onClick={() => setCollapsed(true)}
            aria-label="가이드 접기"
            className="shrink-0 rounded-btn px-2 text-ink-muted hover:text-ink"
          >
            ✕
          </button>
        </div>

        {arrived ? (
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{s.arrived}</p>
        ) : (
          <>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{direction}</p>
            <p className="mt-1 text-sm text-ink-muted">
              도착하면 이 카드가 자세한 설명으로 바뀌어요.
            </p>
          </>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!arrived && s.target && (
            <Link
              href={s.target}
              className="rounded-btn bg-sage-deep px-3 py-1.5 text-sm font-medium text-white shadow-sm"
            >
              바로 가기
            </Link>
          )}
          {last && (
            <button
              onClick={endDemo}
              disabled={isPending}
              className="rounded-btn bg-ink px-3 py-1.5 text-sm font-medium text-white shadow-sm disabled:opacity-50"
            >
              {isPending ? "종료 중…" : "체험 종료하고 가입하러 가기"}
            </button>
          )}
          <span className="ml-auto flex items-center gap-2 text-sm text-ink-muted">
            {step > 0 && (
              <button onClick={() => go(step - 1)} className="rounded-btn border border-border px-2.5 py-1 text-ink">
                이전
              </button>
            )}
            <span>
              {step + 1}/{STEPS.length}
            </span>
            {!last && (
              <button
                onClick={() => go(step + 1)}
                className="rounded-btn bg-sage px-3 py-1 font-medium text-white"
              >
                다음
              </button>
            )}
          </span>
        </div>
      </div>

      {/* 이동 안내 중엔 목표 탭 위에 👇 강조 (탭바는 4칸 균등이라 열 위치로 정렬) */}
      {!arrived && s.tab != null && (
        <div className="pointer-events-none mx-auto mt-1 grid w-full max-w-md grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="text-center text-2xl">
              {i === s.tab ? <span className="inline-block animate-bounce">👇</span> : null}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
