// 실파일 "부모님" 자유텍스트 파싱 (순수 함수, 클라이언트 임포트에서 사용).
// 예: "부:양홍석 85331576\n모:황주영 97860554" → 아빠/엄마 각각 이름·전화 분리.
// 우선순위: 모(엄마)가 있으면 보호자1, 나머지를 보호자2 (한국 교회 연락 관례).

export type ParsedGuardian = {
  relation: "모" | "부" | null;
  name: string;
  phone: string;
};

export type ParsedParents = {
  guardian1: ParsedGuardian | null;
  guardian2: ParsedGuardian | null;
  warning?: string;
};

// "이름 전화" 한 조각에서 이름과 전화(숫자 8자리+)를 분리. 전화 없으면 이름만.
function splitNamePhone(s: string): { name: string; phone: string } {
  const t = s.trim();
  const m = t.match(/([0-9][0-9\s-]*[0-9]|[0-9])\s*$/);
  if (m && m.index !== undefined) {
    const digits = m[1].replace(/\D/g, "");
    if (digits.length >= 8) {
      return { name: t.slice(0, m.index).trim(), phone: digits };
    }
  }
  return { name: t, phone: "" };
}

export function parseParents(raw: string): ParsedParents {
  const text = (raw || "").trim();
  if (!text) return { guardian1: null, guardian2: null };

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");

  const found: ParsedGuardian[] = [];
  for (const line of lines) {
    let relation: "모" | "부" | null = null;
    let rest = line;
    const pm = line.match(/^(부|모|아빠|엄마)\s*[:：]\s*(.*)$/);
    if (pm) {
      relation = pm[1] === "부" || pm[1] === "아빠" ? "부" : "모";
      rest = pm[2];
    }
    const { name, phone } = splitNamePhone(rest);
    if (!name && !phone) continue;
    found.push({ relation, name, phone });
  }

  if (found.length === 0) return { guardian1: null, guardian2: null };

  let warning: string | undefined;
  if (found.length === 1 && found[0].relation === null) {
    warning = "'부:'/'모:' 구분이 없어 보호자1 이름으로 넣음";
  }

  // 모(엄마)가 있으면 보호자1로.
  const mother = found.find((f) => f.relation === "모");
  const ordered = mother ? [mother, ...found.filter((f) => f !== mother)] : found;

  return {
    guardian1: ordered[0] ?? null,
    guardian2: ordered[1] ?? null,
    warning,
  };
}
