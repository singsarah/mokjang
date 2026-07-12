// 모든 화면 하단의 저작자 표기.
export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`pb-4 pt-6 text-center text-sm text-ink-muted ${className}`}
    >
      © 2026 @rebuild.with.Sarah
    </footer>
  );
}
