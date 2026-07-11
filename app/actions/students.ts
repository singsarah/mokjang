"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import { studentSchema, type StudentInput } from "@/lib/validation/student";
import type { ExportStudent } from "@/lib/roster-export";
import type { Database } from "@/lib/supabase/database.types";

type StudentInsert = Database["public"]["Tables"]["students"]["Insert"];

async function requireEditor(): Promise<CurrentMembership> {
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor") throw new Error("편집 권한이 필요합니다");
  return m;
}

function toRow(d: StudentInput) {
  return {
    name: d.name,
    grade: d.grade,
    class_id: d.classId,
    birthday_month: d.birthdayMonth,
    birthday_day: d.birthdayDay,
    birthday_year: d.birthdayYear,
    phone_self: d.phoneSelf,
    phone_guardian: d.phoneGuardian,
    guardian_relation: d.guardianRelation,
    guardian_relation_other: d.guardianRelationOther,
    guardian_name: d.guardianName,
    guardian2_relation: d.guardian2Relation,
    guardian2_name: d.guardian2Name,
    guardian2_phone: d.guardian2Phone,
    school: d.school,
    baptism: d.baptism,
    kakao_id: d.kakaoId,
    address: d.address,
    family_note: d.familyNote,
    note: d.note,
    parent_chat_invited: d.parentChatInvited,
    registration_submitted: d.registrationSubmitted,
    gender: d.gender,
    photo_path: d.photoPath,
  };
}

export async function createStudent(
  input: StudentInput,
): Promise<{ error?: string; id?: string }> {
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("students")
    .insert({ group_id: m.groupId, ...toRow(parsed.data) })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  return { id: data.id };
}

export async function updateStudent(
  input: { id: string } & StudentInput,
): Promise<{ error?: string }> {
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  if (!input.id) return { error: "잘못된 요청" };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("students")
    .update({ ...toRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath(`/settings/roster/${input.id}`);
  return {};
}

export async function softDeleteStudent(input: { id: string }): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("students")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("group_id", m.groupId)
    .is("deleted_at", null);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/hidden");
  return {};
}

// 체크박스로 선택한 학생들 일괄 숨김 처리.
export async function bulkHideStudents(input: { ids: string[] }): Promise<{ error?: string; count?: number }> {
  if (!Array.isArray(input.ids) || input.ids.length === 0) return { error: "선택된 학생이 없습니다" };
  if (input.ids.length > 500) return { error: "한 번에 최대 500명까지 처리할 수 있습니다" };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("students")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", input.ids)
    .eq("group_id", m.groupId)
    .is("deleted_at", null)
    .select("id");
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/hidden");
  revalidatePath("/attendance");
  return { count: data?.length ?? 0 };
}

// 체크박스로 선택한 학생들 일괄 졸업 처리 — 진급과 동일하게 반 배정도 해제.
export async function bulkGraduateStudents(input: { ids: string[] }): Promise<{ error?: string; count?: number }> {
  if (!Array.isArray(input.ids) || input.ids.length === 0) return { error: "선택된 학생이 없습니다" };
  if (input.ids.length > 500) return { error: "한 번에 최대 500명까지 처리할 수 있습니다" };
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("students")
    .update({ graduated_at: new Date().toISOString(), class_id: null, updated_at: new Date().toISOString() })
    .in("id", input.ids)
    .eq("group_id", m.groupId)
    .is("graduated_at", null)
    .select("id");
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/graduated");
  revalidatePath("/attendance");
  return { count: data?.length ?? 0 };
}

export async function restoreStudent(input: { id: string }): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("students")
    .update({ deleted_at: null })
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/hidden");
  return {};
}

export async function promoteGrades(): Promise<{ error?: string }> {
  const m = await requireCurrentMembership();
  if (m.role !== "master") return { error: "진급은 대표 교사만 할 수 있습니다" };
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("promote_group", { p_group_id: m.groupId });
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/graduated");
  return {};
}

export async function restoreGraduate(input: { id: string }): Promise<{ error?: string }> {
  const m = await requireEditor();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("students")
    .update({ graduated_at: null })
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/roster");
  revalidatePath("/settings/roster/graduated");
  return {};
}

// ── 엑셀 전체 명단 다운로드 ────────────────────────────────────

export type ExportStudentsResult = { rows?: ExportStudent[]; error?: string };

// 재적 학생(숨김·졸업 제외) 전체를 모든 필드와 함께 내려받기용으로 반환.
// viewer 는 UI에서 전화번호가 마스킹되어 보이므로, 마스킹 없는 전체 내보내기는 금지.
export async function exportStudents(): Promise<ExportStudentsResult> {
  const m = await requireCurrentMembership();
  if (m.role === "viewer") {
    return { error: "전체 명단 다운로드는 마스터/편집 교사만 할 수 있습니다" };
  }
  const supabase = await createServerClient();

  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name")
    .eq("group_id", m.groupId);
  const classNameById = new Map((classRows ?? []).map((c) => [c.id, c.name]));

  const { data, error } = await supabase
    .from("students")
    .select(
      "name, grade, gender, class_id, birthday_year, birthday_month, birthday_day, phone_self, kakao_id, school, address, guardian_relation, guardian_relation_other, guardian_name, phone_guardian, guardian2_relation, guardian2_name, guardian2_phone, baptism, family_note, note, parent_chat_invited, registration_submitted",
    )
    .eq("group_id", m.groupId)
    .is("deleted_at", null)
    .is("graduated_at", null)
    .order("grade", { ascending: true })
    .order("name", { ascending: true });
  if (error) return { error: error.message };

  const rows: ExportStudent[] = (data ?? []).map((s) => ({
    name: s.name,
    grade: s.grade,
    gender: s.gender,
    className: s.class_id ? (classNameById.get(s.class_id) ?? null) : null,
    birthdayYear: s.birthday_year,
    birthdayMonth: s.birthday_month,
    birthdayDay: s.birthday_day,
    phoneSelf: s.phone_self,
    kakaoId: s.kakao_id,
    school: s.school,
    address: s.address,
    guardianRelation: s.guardian_relation,
    guardianRelationOther: s.guardian_relation_other,
    guardianName: s.guardian_name,
    phoneGuardian: s.phone_guardian,
    guardian2Relation: s.guardian2_relation,
    guardian2Name: s.guardian2_name,
    guardian2Phone: s.guardian2_phone,
    baptism: s.baptism,
    familyNote: s.family_note,
    note: s.note,
    parentChatInvited: s.parent_chat_invited,
    registrationSubmitted: s.registration_submitted,
  }));
  return { rows };
}

// ── 엑셀 대량 업로드 ──────────────────────────────────────────

// 클라이언트가 보내는 원시 행. 값은 전부 문자열/숫자(생일은 문자열로 정규화됨).
// 보호자는 클라이언트에서 '부모님' 자유텍스트 파싱을 마친 뒤 분리된 값으로 전달.
export type ImportRow = {
  name: string;
  grade: number;
  gender?: string;
  className?: string;
  phoneSelf?: string;
  birthday?: string;
  guardian1Relation?: string;
  guardian1Name?: string;
  guardian1Phone?: string;
  guardian2Relation?: string;
  guardian2Name?: string;
  guardian2Phone?: string;
  school?: string;
  baptism?: string;
  kakaoId?: string;
  address?: string;
  familyNote?: string;
  note?: string;
  parentChatInvited?: boolean;
  registrationSubmitted?: boolean;
};

export type ImportResult = {
  inserted: number;
  skipped: { name: string; reason: string }[];
  warnings: string[];
  error?: string;
};

// 클라이언트 검증은 신뢰하지 않고 서버에서 재검증.
const importRowSchema = z.object({
  name: z.string().trim().min(1).max(50),
  grade: z.coerce.number().int().min(1).max(3),
  gender: z.string().trim().optional().default(""),
  className: z.string().trim().max(30).optional().default(""),
  phoneSelf: z.string().trim().max(50).optional().default(""),
  birthday: z.string().trim().max(20).optional().default(""),
  guardian1Relation: z.string().trim().max(30).optional().default(""),
  guardian1Name: z.string().trim().max(50).optional().default(""),
  guardian1Phone: z.string().trim().max(50).optional().default(""),
  guardian2Relation: z.string().trim().max(30).optional().default(""),
  guardian2Name: z.string().trim().max(50).optional().default(""),
  guardian2Phone: z.string().trim().max(50).optional().default(""),
  school: z.string().trim().max(50).optional().default(""),
  baptism: z.string().trim().max(100).optional().default(""),
  kakaoId: z.string().trim().max(50).optional().default(""),
  address: z.string().trim().max(200).optional().default(""),
  familyNote: z.string().trim().max(300).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
  parentChatInvited: z.coerce.boolean().optional().default(false),
  registrationSubmitted: z.coerce.boolean().optional().default(false),
});

// 보호자 관계 문자열 → (guardian_relation, guardian_relation_other) 정규화.
// 모/부/기타는 그대로, 그 외 값은 '기타'+상세로.
function normalizeRelation(raw: string): { relation: string | null; other: string | null } {
  const gr = raw.trim();
  if (gr === "모" || gr === "부" || gr === "기타") return { relation: gr, other: null };
  if (gr === "엄마") return { relation: "모", other: null };
  if (gr === "아빠") return { relation: "부", other: null };
  if (gr) return { relation: "기타", other: gr };
  return { relation: null, other: null };
}

function parseGender(raw: string): "male" | "female" | null {
  const v = raw.trim();
  if (v === "남" || v === "남자") return "male";
  if (v === "여" || v === "여자") return "female";
  return null;
}

// "YYYY-MM-DD" / "YYYY.MM.DD" / "YYYY/MM/DD" 또는 "MM-DD" / "MM/DD"(연도 null) 허용.
// 빈값이면 ok=true(생일 없음), 형식 오류면 ok=false.
function parseBirthday(raw: string): {
  year: number | null;
  month: number | null;
  day: number | null;
  ok: boolean;
} {
  const s = raw.trim();
  if (!s) return { year: null, month: null, day: null, ok: true };
  const fail = { year: null, month: null, day: null, ok: false };
  const parts = s.split(/[-./]/).map((p) => p.trim()).filter((p) => p !== "");
  if (!parts.every((p) => /^\d+$/.test(p))) return fail;
  const nums = parts.map((p) => Number(p));
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  if (parts.length === 3 && parts[0].length === 4) {
    year = nums[0];
    month = nums[1];
    day = nums[2];
  } else if (parts.length === 2) {
    month = nums[0];
    day = nums[1];
  } else {
    return fail;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return fail;
  if (year !== null && (year < 1900 || year > 2100)) return fail;
  return { year, month, day, ok: true };
}

export async function importStudents(rows: ImportRow[]): Promise<ImportResult> {
  const empty: ImportResult = { inserted: 0, skipped: [], warnings: [] };
  if (!Array.isArray(rows)) return { ...empty, error: "잘못된 요청" };
  if (rows.length === 0) return { ...empty, error: "등록할 행이 없습니다" };
  if (rows.length > 500) return { ...empty, error: "한 번에 최대 500명까지 업로드할 수 있습니다" };

  const m = await requireEditor();
  const supabase = await createServerClient();

  // 반 이름(trim) → class_id 맵.
  const { data: classRows } = await supabase
    .from("classes")
    .select("id, name")
    .eq("group_id", m.groupId);
  const classByName = new Map<string, string>();
  for (const c of classRows ?? []) classByName.set(c.name.trim(), c.id);

  // 기존 재적 학생(이름+학년) — 중복이면 skip(덮어쓰기 금지).
  const { data: existingRows } = await supabase
    .from("students")
    .select("name, grade")
    .eq("group_id", m.groupId)
    .is("deleted_at", null)
    .is("graduated_at", null);
  const existingKeys = new Set<string>();
  for (const s of existingRows ?? []) existingKeys.add(`${s.name}${s.grade}`);

  const skipped: { name: string; reason: string }[] = [];
  const warnings: string[] = [];
  const seenInFile = new Set<string>();
  const toInsert: StudentInsert[] = [];

  for (const raw of rows) {
    const parsed = importRowSchema.safeParse(raw);
    if (!parsed.success) {
      const nm = typeof raw?.name === "string" ? raw.name : "(이름 없음)";
      skipped.push({ name: nm, reason: "이름/학년이 올바르지 않음" });
      continue;
    }
    const d = parsed.data;
    const key = `${d.name}${d.grade}`;

    if (seenInFile.has(key)) {
      skipped.push({ name: d.name, reason: "파일 안에서 중복(첫 번째만 등록)" });
      continue;
    }
    seenInFile.add(key);

    if (existingKeys.has(key)) {
      skipped.push({ name: d.name, reason: "이미 등록된 학생(이름+학년)" });
      continue;
    }

    // 반 매칭.
    let classId: string | null = null;
    if (d.className) {
      const found = classByName.get(d.className.trim());
      if (found) classId = found;
      else warnings.push(`${d.name}: 반 '${d.className}'을(를) 찾지 못해 미배정으로 등록`);
    }

    // 생일.
    const bd = parseBirthday(d.birthday);
    if (!bd.ok) warnings.push(`${d.name}: 생일 형식을 알 수 없어 비워둠`);

    // 보호자 1·2 관계 정규화.
    const g1 = normalizeRelation(d.guardian1Relation);
    const g2 = normalizeRelation(d.guardian2Relation);

    toInsert.push({
      group_id: m.groupId,
      name: d.name,
      grade: d.grade,
      class_id: classId,
      gender: parseGender(d.gender),
      phone_self: d.phoneSelf || null,
      phone_guardian: d.guardian1Phone || null,
      guardian_relation: g1.relation,
      guardian_relation_other: g1.other,
      guardian_name: d.guardian1Name || null,
      guardian2_relation: g2.relation,
      guardian2_name: d.guardian2Name || null,
      guardian2_phone: d.guardian2Phone || null,
      school: d.school || null,
      baptism: d.baptism || null,
      kakao_id: d.kakaoId || null,
      address: d.address || null,
      family_note: d.familyNote || null,
      note: d.note || null,
      parent_chat_invited: d.parentChatInvited,
      registration_submitted: d.registrationSubmitted,
      birthday_year: bd.year,
      birthday_month: bd.month,
      birthday_day: bd.day,
    });
  }

  if (toInsert.length === 0) {
    return { inserted: 0, skipped, warnings };
  }

  const { error } = await supabase.from("students").insert(toInsert);
  if (error) return { inserted: 0, skipped, warnings, error: error.message };

  revalidatePath("/settings/roster");
  return { inserted: toInsert.length, skipped, warnings };
}
