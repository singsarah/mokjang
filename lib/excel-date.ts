// 엑셀 날짜 Date → "YYYY-MM-DD" 안전 변환.
//
// ⚠️ SheetJS(cellDates:true)가 만드는 Date 를 로컬/UTC 컴포넌트로 그대로 읽으면 안 됨:
// serial → Date 변환이 로컬 타임존 기준인데, 1899년(엑셀 epoch) 당시의 역사적 오프셋에
// 초 단위 잔차가 있는 지역(예: Asia/Singapore LMT +6:55:25)에서는 Date 가 로컬 자정보다
// 몇 초 이른 "전날 23:59:xx" 로 나와 날짜가 하루 당겨진다 (2026-07 학적부 업로드 버그).
//
// 해결: 12시간을 더한 뒤 로컬 날짜를 읽는다. 의도가 "그 날짜의 자정 부근"인 Date 는
// (로컬 자정 ± 몇 분, UTC 자정 어느 쪽이든) 정오 부근으로 이동해 항상 올바른 날짜가 된다.
export function excelDateToYmd(d: Date): string | null {
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date(d.getTime() + 12 * 60 * 60 * 1000);
  const y = t.getFullYear();
  const mo = String(t.getMonth() + 1).padStart(2, "0");
  const day = String(t.getDate()).padStart(2, "0");
  return `${String(y).padStart(4, "0")}-${mo}-${day}`;
}
