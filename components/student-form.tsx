"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";
import { createStudent, updateStudent } from "@/app/actions/students";
import { createClient } from "@/lib/supabase/client";
import type { RosterClass } from "@/lib/students";
import type { StudentInput } from "@/lib/validation/student";

type Initial = {
  name: string;
  grade: number | null;
  classId: string | null;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  birthdayYear: number | null;
  phoneSelf: string | null;
  phoneGuardian: string | null;
  guardianRelation: string | null;
  guardianRelationOther: string | null;
  school: string | null;
  note: string | null;
  photoPath: string | null;
};

export function StudentForm({
  classes,
  groupId,
  initial,
  initialPhotoUrl,
  studentId,
}: {
  classes: RosterClass[];
  groupId: string;
  initial?: Initial;
  initialPhotoUrl?: string;
  studentId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  // 사진 상태: 경로는 payload로, 미리보기 URL은 화면 표시용.
  const [photoPath, setPhotoPath] = useState<string | null>(
    initial?.photoPath ?? null,
  );
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(
    initialPhotoUrl,
  );
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string>();

  // 보호자 관계: '기타' 선택 시 상세 입력칸을 보여주려 controlled 상태로.
  const [relation, setRelation] = useState(initial?.guardianRelation ?? "");

  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(undefined);
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${groupId}/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("student-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) {
        setPhotoError("사진 업로드 실패: " + upErr.message);
        return;
      }
      setPhotoPath(path);
      setPhotoPreview(URL.createObjectURL(file));
    } finally {
      setUploading(false);
    }
  }

  function onSubmit(formData: FormData) {
    setError(undefined);
    const payload = {
      name: String(formData.get("name") ?? ""),
      grade: initial?.grade ?? null, // 학년은 폼에서 받지 않음(반 중심). 기존 값 보존.
      classId: (formData.get("classId") as string) || null,
      birthdayMonth: formData.get("birthdayMonth") ? Number(formData.get("birthdayMonth")) : null,
      birthdayDay: formData.get("birthdayDay") ? Number(formData.get("birthdayDay")) : null,
      birthdayYear: formData.get("birthdayYear") ? Number(formData.get("birthdayYear")) : null,
      phoneSelf: (formData.get("phoneSelf") as string) || null,
      phoneGuardian: (formData.get("phoneGuardian") as string) || null,
      guardianRelation: ((relation || null) as StudentInput["guardianRelation"]),
      guardianRelationOther:
        relation === "기타"
          ? (formData.get("guardianRelationOther") as string) || null
          : null,
      school: (formData.get("school") as string) || null,
      note: (formData.get("note") as string) || null,
      photoPath,
    };
    startTransition(async () => {
      const result = studentId
        ? await updateStudent({ id: studentId, ...payload })
        : await createStudent(payload);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push("/settings/roster");
    });
  }

  const input =
    "mt-1 w-full rounded-btn border border-border bg-white px-3 py-2 text-ink";
  return (
    <form action={onSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-card">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreview}
              alt="학생 사진"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl">
              🐑
            </div>
          )}
        </div>
        <div>
          <label className="inline-block cursor-pointer rounded-btn border border-border bg-white px-3 py-2 text-sm text-ink hover:bg-card">
            {photoPreview ? "사진 변경" : "사진 선택"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickPhoto}
              disabled={uploading}
            />
          </label>
          {uploading && (
            <p className="mt-1 text-xs text-ink-muted">업로드 중...</p>
          )}
          {photoError && (
            <p className="mt-1 text-xs text-danger">{photoError}</p>
          )}
        </div>
      </div>

      <label className="block">
        <span className="text-sm">이름 *</span>
        <input name="name" required defaultValue={initial?.name} className={input} />
      </label>
      <label className="block">
        <span className="text-sm">반</span>
        <select name="classId" defaultValue={initial?.classId ?? ""} className={input}>
          <option value="">반 없음</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm">학교</span>
        <input
          name="school"
          defaultValue={initial?.school ?? ""}
          placeholder="예: OO고등학교"
          className={input}
        />
      </label>
      <div className="flex gap-2">
        <label className="block flex-1">
          <span className="text-sm">생일 월</span>
          <input name="birthdayMonth" type="number" min={1} max={12} defaultValue={initial?.birthdayMonth ?? ""} className={input} />
        </label>
        <label className="block flex-1">
          <span className="text-sm">일</span>
          <input name="birthdayDay" type="number" min={1} max={31} defaultValue={initial?.birthdayDay ?? ""} className={input} />
        </label>
        <label className="block flex-1">
          <span className="text-sm">연(선택)</span>
          <input name="birthdayYear" type="number" defaultValue={initial?.birthdayYear ?? ""} className={input} />
        </label>
      </div>
      <label className="block">
        <span className="text-sm">본인 연락처</span>
        <input name="phoneSelf" defaultValue={initial?.phoneSelf ?? ""} className={input} />
      </label>
      <label className="block">
        <span className="text-sm">보호자 연락처</span>
        <input name="phoneGuardian" defaultValue={initial?.phoneGuardian ?? ""} className={input} />
      </label>
      <label className="block">
        <span className="text-sm">보호자 관계</span>
        <select
          name="guardianRelation"
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
          className={input}
        >
          <option value="">선택 안 함</option>
          <option value="모">모</option>
          <option value="부">부</option>
          <option value="기타">기타</option>
        </select>
      </label>
      {relation === "기타" && (
        <label className="block">
          <span className="text-sm">기타 관계 (직접 입력)</span>
          <input
            name="guardianRelationOther"
            defaultValue={initial?.guardianRelationOther ?? ""}
            placeholder="예: 조모, 삼촌, 위탁 등"
            className={input}
          />
        </label>
      )}
      <label className="block">
        <span className="text-sm">기타 (선생님 메모)</span>
        <textarea
          name="note"
          rows={3}
          defaultValue={initial?.note ?? ""}
          placeholder="학생에 대해 남길 메모를 자유롭게 적으세요"
          className={input}
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={isPending || uploading}
        className="w-full rounded-btn bg-sage py-3 font-medium text-white shadow-sm transition hover:bg-sage-deep disabled:opacity-50"
      >
        {isPending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
