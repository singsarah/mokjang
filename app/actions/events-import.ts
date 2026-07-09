"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership, type CurrentMembership } from "@/lib/memberships";
import { parseEventTemplate, type ExtractedEvent } from "@/lib/parse-event-template";
import type { Database } from "@/lib/supabase/database.types";

export type { ExtractedEvent } from "@/lib/parse-event-template";

type EventInsert = Database["public"]["Tables"]["calendar_events"]["Insert"];

// 일정 쓰기는 master/editor 만 가능 (viewer 는 조회 전용 — RLS 와 동일 기준).
async function requireEditor(): Promise<CurrentMembership> {
  const m = await requireCurrentMembership();
  if (m.role === "viewer") {
    throw new Error("일정 등록은 편집 권한이 있는 교사만 할 수 있습니다");
  }
  return m;
}

// ── AI 추출 ──────────────────────────────────────────────────

export type ExtractEventsResult = {
  events?: ExtractedEvent[];
  warnings?: string[];
  error?: string;
};

// Claude 구조화 출력용 JSON Schema (API 는 minLength 등 제약 미지원 → zod 로 후검증).
const EVENTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["events"],
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "title", "time", "description"],
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          title: { type: "string" },
          time: { type: ["string", "null"], description: "HH:MM 24h or null" },
          description: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

function isRealDate(s: string): boolean {
  const [y, mo, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

// AI 출력 후검증 스키마.
const extractedEventSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식 오류")
    .refine(isRealDate, "존재하지 않는 날짜"),
  title: z.string().trim().min(1).max(100),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  description: z.string().max(500).nullable(),
});

// "9:30" → "09:30" 같은 가벼운 정규화. 형식이 아예 다르면 그대로 두고 zod 가 거름.
function normalizeTime(t: unknown): unknown {
  if (typeof t !== "string") return t;
  const s = t.trim();
  if (s === "") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function kstToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function buildPrompt(today: string, excelText?: string): string {
  const base = `이 문서는 교회 고등부(청소년부)의 일정표입니다. 문서에 나오는 날짜가 있는 일정 항목을 전부 이벤트로 추출해주세요.

오늘 날짜(한국 시간): ${today}

규칙:
- date 는 YYYY-MM-DD 형식. 문서에 월/일만 있으면 문서 문맥(예: "2026" 같은 제목/머리글)에서 연도를 추론하고, 단서가 없으면 날짜들이 오늘과 가장 가까워지는 연도를 선택하세요.
- 교육 내용/담당/광고 같은 열은 합리적으로 조합하세요: 핵심 내용이 title, 부가 정보(기도담당, 경건회기도 등)는 description 에 넣으세요.
- 의미 있는 내용이 없는 행은 건너뛰세요.
- time 은 문서에 명시적으로 시간이 있을 때만 HH:MM(24시간)으로, 없으면 null.
- description 이 없으면 null.`;
  if (excelText !== undefined) {
    return `${base}

아래는 엑셀 파일 내용을 CSV 텍스트로 변환한 것입니다:

${excelText}`;
  }
  return base;
}

const IMAGE_TYPES: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
};

function detectKind(file: File): "excel" | "pdf" | "image" | null {
  const name = file.name.toLowerCase();
  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  ) {
    return "excel";
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (IMAGE_TYPES[file.type]) return "image";
  if (/\.(jpe?g|png|webp|gif)$/.test(name)) return "image";
  return null;
}

function imageMediaType(file: File): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  if (IMAGE_TYPES[file.type]) return IMAGE_TYPES[file.type];
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function extractEventsFromFile(
  formData: FormData,
): Promise<ExtractEventsResult> {
  await requireEditor();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "파일을 선택해주세요" };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: "파일이 너무 큽니다 (최대 10MB)" };
  }

  const kind = detectKind(file);
  if (!kind) {
    return { error: "지원하지 않는 파일 형식입니다 (이미지 JPG/PNG/WebP, PDF, 엑셀만 가능)" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const today = kstToday();

  // 파일 종류별 메시지 콘텐츠 구성.
  const content: Anthropic.ContentBlockParam[] = [];
  if (kind === "excel") {
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(buffer, { cellDates: true });
    } catch {
      return { error: "엑셀 파일을 읽을 수 없습니다. 파일이 손상되지 않았는지 확인해주세요." };
    }

    // 1) 템플릿(날짜|시간|제목|설명 헤더) 이면 AI 호출 없이 바로 등록 — 키 불필요.
    const template = parseEventTemplate(wb);
    if (template.matched) {
      if (template.events.length === 0) {
        return {
          warnings: template.warnings,
          error: "템플릿에서 등록 가능한 일정을 찾지 못했습니다. 날짜/제목을 확인해주세요.",
        };
      }
      return { events: template.events, warnings: template.warnings };
    }

    // 2) 템플릿이 아니면 자유 형식 → AI 추출 (여기서부터만 키 필요).
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        error:
          "이 엑셀은 템플릿 양식이 아니라 자동 인식할 수 없습니다. 템플릿 양식(날짜/시간/제목/설명 열)으로 올리면 API 키 없이 바로 등록됩니다. 자유 형식 엑셀을 AI로 읽으려면 ANTHROPIC_API_KEY 설정이 필요합니다. (콘솔에서 키 발급 후 .env.local과 Vercel에 추가)",
      };
    }

    let excelText: string;
    try {
      excelText = wb.SheetNames.map((name) => {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
        return `=== 시트: ${name} ===\n${csv}`;
      }).join("\n\n");
    } catch {
      return { error: "엑셀 파일을 읽을 수 없습니다. 파일이 손상되지 않았는지 확인해주세요." };
    }
    if (excelText.trim() === "") {
      return { error: "엑셀 파일에서 내용을 찾을 수 없습니다" };
    }
    content.push({ type: "text", text: buildPrompt(today, excelText) });
  } else {
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        error:
          "AI 추출 기능을 쓰려면 ANTHROPIC_API_KEY 설정이 필요합니다. (콘솔에서 키 발급 후 .env.local과 Vercel에 추가)",
      };
    }
  }

  if (kind === "pdf") {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: buffer.toString("base64"),
      },
    });
    content.push({ type: "text", text: buildPrompt(today) });
  } else if (kind === "image") {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: imageMediaType(file),
        data: buffer.toString("base64"),
      },
    });
    content.push({ type: "text", text: buildPrompt(today) });
  }

  let response: Anthropic.Message;
  try {
    const client = new Anthropic(); // ANTHROPIC_API_KEY 를 읽음
    response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: EVENTS_SCHEMA } },
      messages: [{ role: "user", content }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { error: "ANTHROPIC_API_KEY 가 잘못되었습니다. 키를 다시 확인해주세요." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { error: "AI 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." };
    }
    if (err instanceof Anthropic.APIError) {
      return { error: `AI 호출 중 오류가 발생했습니다: ${err.message}` };
    }
    throw err;
  }

  if (response.stop_reason === "refusal") {
    return { error: "AI가 이 문서를 처리할 수 없다고 판단했습니다. 다른 파일로 시도해주세요." };
  }

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  if (!textBlock) {
    return { error: "AI 응답이 비어 있습니다. 다시 시도해주세요." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    return { error: "AI 응답을 해석할 수 없습니다. 다시 시도해주세요." };
  }

  const rawEvents =
    parsed && typeof parsed === "object" && Array.isArray((parsed as { events?: unknown }).events)
      ? ((parsed as { events: unknown[] }).events)
      : null;
  if (!rawEvents) {
    return { error: "AI 응답 형식이 올바르지 않습니다. 다시 시도해주세요." };
  }

  const events: ExtractedEvent[] = [];
  const warnings: string[] = [];
  for (const raw of rawEvents) {
    const obj = raw as Record<string, unknown> | null;
    const candidate = {
      ...(typeof obj === "object" && obj !== null ? obj : {}),
      time: normalizeTime(obj?.time),
    };
    const result = extractedEventSchema.safeParse(candidate);
    if (result.success) {
      events.push(result.data);
    } else {
      const label =
        typeof obj?.title === "string" && obj.title.trim() !== ""
          ? obj.title
          : typeof obj?.date === "string"
            ? obj.date
            : "(알 수 없는 항목)";
      warnings.push(`"${label}" 항목은 형식이 맞지 않아 제외했습니다`);
    }
  }

  if (events.length === 0) {
    return {
      warnings,
      error: "문서에서 일정을 찾지 못했습니다. 일정표가 맞는지 확인해주세요.",
    };
  }

  return { events, warnings };
}

// ── 확정(일괄 등록) ──────────────────────────────────────────

export type EventImportResult = {
  inserted: number;
  skipped: { title: string; reason: string }[];
  error?: string;
};

const confirmRowSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식 오류")
    .refine(isRealDate, "존재하지 않는 날짜"),
  title: z.string().trim().min(1, "제목 없음").max(100),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  description: z.string().trim().max(500).nullable(),
});

export async function confirmImportedEvents(
  rows: ExtractedEvent[],
): Promise<EventImportResult> {
  const empty: EventImportResult = { inserted: 0, skipped: [] };
  if (!Array.isArray(rows)) return { ...empty, error: "잘못된 요청" };
  if (rows.length === 0) return { ...empty, error: "등록할 일정이 없습니다" };
  if (rows.length > 200) return { ...empty, error: "한 번에 최대 200건까지 등록할 수 있습니다" };

  const m = await requireEditor();
  const supabase = await createServerClient();

  const skipped: { title: string; reason: string }[] = [];
  const valid: z.infer<typeof confirmRowSchema>[] = [];
  for (const raw of rows) {
    const parsed = confirmRowSchema.safeParse({
      ...raw,
      time: normalizeTime(raw?.time),
      description:
        typeof raw?.description === "string" && raw.description.trim() === ""
          ? null
          : raw?.description,
    });
    if (!parsed.success) {
      const nm = typeof raw?.title === "string" && raw.title ? raw.title : "(제목 없음)";
      skipped.push({ title: nm, reason: "날짜 또는 제목이 올바르지 않음" });
      continue;
    }
    valid.push(parsed.data);
  }

  if (valid.length === 0) return { inserted: 0, skipped };

  // 관련 날짜의 기존 일정 조회 → (event_date, title) 중복은 건너뜀.
  const dates = Array.from(new Set(valid.map((r) => r.date)));
  const { data: existingRows, error: loadError } = await supabase
    .from("calendar_events")
    .select("event_date, title")
    .eq("group_id", m.groupId)
    .in("event_date", dates);
  if (loadError) return { inserted: 0, skipped, error: loadError.message };

  const existing = new Set<string>();
  for (const e of existingRows ?? []) existing.add(`${e.event_date}__${e.title.trim()}`);

  const seenInBatch = new Set<string>();
  const toInsert: EventInsert[] = [];
  for (const r of valid) {
    const key = `${r.date}__${r.title}`;
    if (seenInBatch.has(key)) {
      skipped.push({ title: r.title, reason: "목록 안에서 중복(첫 번째만 등록)" });
      continue;
    }
    seenInBatch.add(key);
    if (existing.has(key)) {
      skipped.push({ title: r.title, reason: "같은 날짜에 이미 등록된 일정" });
      continue;
    }
    toInsert.push({
      group_id: m.groupId,
      title: r.title,
      event_date: r.date,
      event_time: r.time,
      description: r.description,
      source: "import",
      created_by: m.userId,
    });
  }

  if (toInsert.length === 0) return { inserted: 0, skipped };

  const { error } = await supabase.from("calendar_events").insert(toInsert);
  if (error) return { inserted: 0, skipped, error: error.message };

  revalidatePath("/calendar");
  return { inserted: toInsert.length, skipped };
}
