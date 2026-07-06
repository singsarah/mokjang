-- 학생 사진: 비공개 Storage 버킷 + 학생 테이블 photo_path.
-- 경로 규칙 = <group_id>/<파일명>. 첫 폴더가 사용자의 활성 그룹이어야 접근 가능.

ALTER TABLE students ADD COLUMN photo_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('student-photos', 'student-photos', false)
ON CONFLICT (id) DO NOTHING;

-- 읽기: 해당 그룹의 활성 멤버 전원 (조회 교사 포함)
CREATE POLICY "read student photos in own group"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'student-photos'
    AND is_active_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

-- 쓰기/수정/삭제: master·editor만
CREATE POLICY "editors insert student photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'student-photos'
    AND user_role_in_group(((storage.foldername(name))[1])::uuid, auth.uid()) IN ('master','editor')
  );

CREATE POLICY "editors update student photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'student-photos'
    AND user_role_in_group(((storage.foldername(name))[1])::uuid, auth.uid()) IN ('master','editor')
  );

CREATE POLICY "editors delete student photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'student-photos'
    AND user_role_in_group(((storage.foldername(name))[1])::uuid, auth.uid()) IN ('master','editor')
  );
