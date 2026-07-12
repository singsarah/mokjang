import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requireCurrentMembership } from "@/lib/memberships";
import { loadRoster } from "@/lib/students";
import { StudentForm } from "@/components/student-form";
import { softDeleteStudent } from "@/app/actions/students";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const m = await requireCurrentMembership();
  if (m.role !== "master" && m.role !== "editor") redirect("/settings/roster");

  const supabase = await createServerClient();
  const { data: s } = await supabase
    .from("students")
    .select("id, name, grade, class_id, birthday_month, birthday_day, birthday_year, phone_self, phone_guardian, guardian_relation, guardian_relation_other, guardian_name, guardian2_relation, guardian2_name, guardian2_phone, school, baptism, kakao_id, address, family_note, note, parent_chat_invited, registration_submitted, gender, photo_path")
    .eq("id", studentId)
    .eq("group_id", m.groupId)
    .maybeSingle();
  if (!s) redirect("/settings/roster");

  const { classes } = await loadRoster();

  // 기존 사진이 있으면 미리보기용 서명 URL 생성 (비공개 버킷).
  let initialPhotoUrl: string | undefined;
  if (s.photo_path) {
    const { data: signed } = await supabase.storage
      .from("student-photos")
      .createSignedUrl(s.photo_path, 3600);
    initialPhotoUrl = signed?.signedUrl;
  }

  return (
    <main className="min-h-screen bg-card pb-36">
      <div className="mx-auto max-w-md px-6 py-8">
      <Link
        href="/settings/roster"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← 학적부
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-ink">학생 수정</h1>
      <div className="mt-6 rounded-card border border-border/60 bg-white p-5 shadow-sm">
        <StudentForm
          classes={classes}
          groupId={m.groupId}
          studentId={s.id}
          initialPhotoUrl={initialPhotoUrl}
          initial={{
            name: s.name,
            grade: s.grade,
            classId: s.class_id,
            birthdayMonth: s.birthday_month,
            birthdayDay: s.birthday_day,
            birthdayYear: s.birthday_year,
            phoneSelf: s.phone_self,
            phoneGuardian: s.phone_guardian,
            guardianRelation: s.guardian_relation,
            guardianRelationOther: s.guardian_relation_other,
            guardianName: s.guardian_name,
            guardian2Relation: s.guardian2_relation,
            guardian2Name: s.guardian2_name,
            guardian2Phone: s.guardian2_phone,
            school: s.school,
            baptism: s.baptism,
            kakaoId: s.kakao_id,
            address: s.address,
            familyNote: s.family_note,
            note: s.note,
            parentChatInvited: s.parent_chat_invited,
            registrationSubmitted: s.registration_submitted,
            gender: s.gender,
            photoPath: s.photo_path,
          }}
        />
      </div>

      <form
        action={async () => {
          "use server";
          await softDeleteStudent({ id: studentId });
          redirect("/settings/roster");
        }}
        className="mt-8"
      >
        <button className="w-full rounded-btn border border-danger py-3 text-danger transition hover:bg-unconfirmed-soft">
          학생 삭제 (숨김 처리)
        </button>
      </form>
      </div>
    </main>
  );
}
