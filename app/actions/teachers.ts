"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import { teacherSchema, type TeacherInput } from "@/lib/validation/teacher";
import type { ExportTeacher } from "@/lib/roster-export";
import type { Database } from "@/lib/supabase/database.types";

type TeacherInsert = Database["public"]["Tables"]["teachers"]["Insert"];

// 교사 관리는 대표 교사(master) 전용.
async function requireMaster(): Promise<CurrentMembership> {
  const m = await requireCurrentMembership();
  if (m.role !== "master") throw new Error("교사 관리는 대표 교사만 할 수 있습니다");
  return m;
}

function toRow(d: TeacherInput) {
  return {
    name: d.name,
    birthday_month: d.birthdayMonth,
    birthday_day: d.birthdayDay,
    birthday_year: d.birthdayYear,
    phone: d.phone,
    kakao_id: d.kakaoId,
    duty: d.duty,
    job_type: d.jobType,
    note: d.note,
  };
}

export async function createTeacher(
  input: TeacherInput,
): Promise<{ error?: string; id?: string }> {
  const parsed = teacherSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const m = await requireMaster();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("teachers")
    .insert({ group_id: m.groupId, ...toRow(parsed.data) })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/settings/teachers");
  return { id: data.id };
}

export async function updateTeacher(
  input: { id: string } & TeacherInput,
): Promise<{ error?: string }> {
  const parsed = teacherSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  if (!input.id) return { error: "잘못된 요청" };
  const m = await requireMaster();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("teachers")
    .update({ ...toRow(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/teachers");
  revalidatePath(`/settings/teachers/roster/${input.id}`);
  return {};
}

export async function deleteTeacher(input: { id: string }): Promise<{ error?: string }> {
  const m = await requireMaster();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("teachers")
    .delete()
    .eq("id", input.id)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/teachers");
  return {};
}

// ── 명단 ↔ 가입 계정 연결 ─────────────────────────────────────
// 명단(teachers)은 계정 없이도 존재하므로, 가입한 교사를 명단의 어느 행인지
// 마스터가 지정해 연결한다. 한 계정은 한 행에만(UNIQUE user_id).

export async function linkTeacherAccount(input: {
  teacherId: string;
  userId: string;
}): Promise<{ error?: string }> {
  const parsed = z
    .object({ teacherId: z.string().uuid(), userId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { error: "잘못된 요청" };
  const m = await requireMaster();
  const supabase = await createServerClient();

  // 연결 대상 계정이 이 그룹의 멤버인지 확인 (임의 uuid 연결 방지)
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("group_id", m.groupId)
    .eq("user_id", parsed.data.userId)
    .in("status", ["pending", "active"])
    .maybeSingle();
  if (!membership) return { error: "이 그룹의 교사 계정이 아니에요" };

  const { data: updated, error } = await supabase
    .from("teachers")
    .update({ user_id: parsed.data.userId, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.teacherId)
    .eq("group_id", m.groupId)
    .is("user_id", null)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return { error: "이 계정은 이미 다른 명단에 연결돼 있어요" };
    return { error: error.message };
  }
  if (!updated) return { error: "이미 다른 계정과 연결된 명단이에요" };
  revalidatePath("/settings/teachers");
  return {};
}

export async function unlinkTeacherAccount(input: { teacherId: string }): Promise<{ error?: string }> {
  const m = await requireMaster();
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("teachers")
    .update({ user_id: null, updated_at: new Date().toISOString() })
    .eq("id", input.teacherId)
    .eq("group_id", m.groupId);
  if (error) return { error: error.message };
  revalidatePath("/settings/teachers");
  return {};
}

// ── 엑셀 전체 명단 다운로드 ────────────────────────────────────

export type ExportTeachersResult = { rows?: ExportTeacher[]; error?: string };

// 교사 명단 전체를 모든 필드와 함께 내려받기용으로 반환. 교사 관리는 master 전용.
export async function exportTeachers(): Promise<ExportTeachersResult> {
  const m = await requireCurrentMembership();
  if (m.role !== "master") {
    return { error: "교사 명단 다운로드는 대표 교사만 할 수 있습니다" };
  }
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("teachers")
    .select("name, birthday_year, birthday_month, birthday_day, phone, kakao_id, duty, job_type, note")
    .eq("group_id", m.groupId)
    .order("name", { ascending: true });
  if (error) return { error: error.message };

  const rows: ExportTeacher[] = (data ?? []).map((t) => ({
    name: t.name,
    birthdayYear: t.birthday_year,
    birthdayMonth: t.birthday_month,
    birthdayDay: t.birthday_day,
    phone: t.phone,
    kakaoId: t.kakao_id,
    duty: t.duty,
    jobType: t.job_type,
    note: t.note,
  }));
  return { rows };
}

// ── 엑셀 대량 업로드 ──────────────────────────────────────────

// 클라이언트가 보내는 원시 행. 생일은 문자열로 정규화됨, 전화는 문자열.
export type TeacherImportRow = {
  name: string;
  birthday?: string;
  phone?: string;
  kakaoId?: string;
  duty?: string;
  jobType?: string;
  note?: string;
};

export type TeacherImportResult = {
  inserted: number;
  skipped: { name: string; reason: string }[];
  warnings: string[];
  error?: string;
};

// 클라이언트 검증은 신뢰하지 않고 서버에서 재검증.
const importRowSchema = z.object({
  name: z.string().trim().min(1).max(50),
  birthday: z.string().trim().max(20).optional().default(""),
  phone: z.string().trim().max(50).optional().default(""),
  kakaoId: z.string().trim().max(50).optional().default(""),
  duty: z.string().trim().max(50).optional().default(""),
  jobType: z.string().trim().max(30).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
});

// "YYYY-MM-DD" / "YYYY.MM.DD" / "YYYY/MM/DD" 또는 "M-D" / "M/D"(연도 null) 허용.
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

export async function importTeachers(
  rows: TeacherImportRow[],
): Promise<TeacherImportResult> {
  const empty: TeacherImportResult = { inserted: 0, skipped: [], warnings: [] };
  if (!Array.isArray(rows)) return { ...empty, error: "잘못된 요청" };
  if (rows.length === 0) return { ...empty, error: "등록할 행이 없습니다" };
  if (rows.length > 200) return { ...empty, error: "한 번에 최대 200명까지 업로드할 수 있습니다" };

  const m = await requireMaster();
  const supabase = await createServerClient();

  // 기존 교사 이름 — 같은 이름이 있으면 skip(덮어쓰기 금지).
  const { data: existingRows } = await supabase
    .from("teachers")
    .select("name")
    .eq("group_id", m.groupId);
  const existingNames = new Set<string>();
  for (const t of existingRows ?? []) existingNames.add(t.name.trim());

  const skipped: { name: string; reason: string }[] = [];
  const warnings: string[] = [];
  const seenInFile = new Set<string>();
  const toInsert: TeacherInsert[] = [];

  for (const raw of rows) {
    const parsed = importRowSchema.safeParse(raw);
    if (!parsed.success) {
      const nm = typeof raw?.name === "string" ? raw.name : "(이름 없음)";
      skipped.push({ name: nm, reason: "이름이 올바르지 않음" });
      continue;
    }
    const d = parsed.data;

    if (seenInFile.has(d.name)) {
      skipped.push({ name: d.name, reason: "파일 안에서 중복(첫 번째만 등록)" });
      continue;
    }
    seenInFile.add(d.name);

    if (existingNames.has(d.name)) {
      skipped.push({ name: d.name, reason: "이미 등록된 교사(이름)" });
      continue;
    }

    const bd = parseBirthday(d.birthday);
    if (!bd.ok) warnings.push(`${d.name}: 생일 형식을 알 수 없어 비워둠`);

    toInsert.push({
      group_id: m.groupId,
      name: d.name,
      birthday_year: bd.year,
      birthday_month: bd.month,
      birthday_day: bd.day,
      phone: d.phone || null,
      kakao_id: d.kakaoId || null,
      duty: d.duty || null,
      job_type: d.jobType || null,
      note: d.note || null,
    });
  }

  if (toInsert.length === 0) {
    return { inserted: 0, skipped, warnings };
  }

  const { error } = await supabase.from("teachers").insert(toInsert);
  if (error) return { inserted: 0, skipped, warnings, error: error.message };

  revalidatePath("/settings/teachers");
  return { inserted: toInsert.length, skipped, warnings };
}
