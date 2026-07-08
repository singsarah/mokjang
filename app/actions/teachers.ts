"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import { teacherSchema, type TeacherInput } from "@/lib/validation/teacher";
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
