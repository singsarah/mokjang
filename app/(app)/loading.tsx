import { Icon } from "@/components/icon";

// 탭 이동 시 서버 응답을 기다리는 동안 즉시 표시되는 로딩 화면.
export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg pb-20">
      <div className="animate-bounce">
        <Icon name="sheep-face" size={44} />
      </div>
      <p className="text-sm text-ink-muted">불러오는 중…</p>
    </div>
  );
}
