// 학적부/교사 명단 "엑셀 다운로드" 행 매핑 — 순수 함수.
// 열 순서·헤더 문자열은 components/student-import.tsx / teacher-import.tsx 의 업로드 양식과
// 반드시 동일하게 맞춘다 — 다운로드한 파일을 그대로 다시 업로드해도 파싱되도록(왕복 호환) 하기 위함.
// app/actions/students.ts, app/actions/teachers.ts, 클라이언트 다운로드 버튼,
// tests/unit/roster-export.test.ts 양쪽에서 import 하므로 서버 전용 import 는 추가하지 말 것.

export const STUDENT_EXPORT_HEADERS = [
  "이름", "학년", "성별", "반", "생일", "전화번호", "카카오톡 ID", "학교", "주소",
  "보호자1 관계", "보호자1 이름", "보호자1 연락처",
  "보호자2 관계", "보호자2 이름", "보호자2 연락처",
  "세례/입교", "가족", "비고", "단톡방 초대", "등록지원서",
];

export type ExportStudent = {
  name: string;
  grade: number | null;
  gender: string | null; // "male" | "female" | null
  className: string | null;
  birthdayYear: number | null;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  phoneSelf: string | null;
  kakaoId: string | null;
  school: string | null;
  address: string | null;
  guardianRelation: string | null; // "모" | "부" | "기타" | null
  guardianRelationOther: string | null; // 관계가 '기타'일 때 상세
  guardianName: string | null;
  phoneGuardian: string | null; // 보호자1 연락처
  guardian2Relation: string | null;
  guardian2Name: string | null;
  guardian2Phone: string | null;
  baptism: string | null;
  familyNote: string | null;
  note: string | null;
  parentChatInvited: boolean;
  registrationSubmitted: boolean;
};

function str(v: string | null | undefined): string {
  return v ?? "";
}

function genderKo(g: string | null): string {
  return g === "male" ? "남" : g === "female" ? "여" : "";
}

function boolKo(b: boolean): string {
  return b ? "O" : "";
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// year 있으면 "YYYY-MM-DD", 없으면 "MM-DD" — app/actions/*.ts 의 parseBirthday 가 둘 다 인식.
export function formatBirthday(
  year: number | null,
  month: number | null,
  day: number | null,
): string {
  if (month == null || day == null) return "";
  return year != null ? `${year}-${pad2(month)}-${pad2(day)}` : `${pad2(month)}-${pad2(day)}`;
}

// 보호자1 관계: '기타'면 상세(guardianRelationOther)를 그대로 노출.
// 재업로드 시 normalizeRelation() 이 모/부/기타가 아닌 문자열을 '기타'+상세로 다시 인식하므로
// 상세가 있으면 그대로, 없으면 "기타" 라는 문자열 자체를 넣어 왕복시킨다.
function guardian1RelationKo(relation: string | null, other: string | null): string {
  if (relation === "기타") return other && other.trim() !== "" ? other : "기타";
  return str(relation);
}

export function studentExportRow(s: ExportStudent): (string | number)[] {
  return [
    s.name,
    s.grade ?? "",
    genderKo(s.gender),
    str(s.className),
    formatBirthday(s.birthdayYear, s.birthdayMonth, s.birthdayDay),
    str(s.phoneSelf),
    str(s.kakaoId),
    str(s.school),
    str(s.address),
    guardian1RelationKo(s.guardianRelation, s.guardianRelationOther),
    str(s.guardianName),
    str(s.phoneGuardian),
    str(s.guardian2Relation),
    str(s.guardian2Name),
    str(s.guardian2Phone),
    str(s.baptism),
    str(s.familyNote),
    str(s.note),
    boolKo(s.parentChatInvited),
    boolKo(s.registrationSubmitted),
  ];
}

export const TEACHER_EXPORT_HEADERS = [
  "이름", "생일", "전화번호", "카카오톡 ID", "담당", "직장인/학생", "비고",
];

export type ExportTeacher = {
  name: string;
  birthdayYear: number | null;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  phone: string | null;
  kakaoId: string | null;
  duty: string | null;
  jobType: string | null;
  note: string | null;
};

export function teacherExportRow(t: ExportTeacher): (string | number)[] {
  return [
    t.name,
    formatBirthday(t.birthdayYear, t.birthdayMonth, t.birthdayDay),
    str(t.phone),
    str(t.kakaoId),
    str(t.duty),
    str(t.jobType),
    str(t.note),
  ];
}
