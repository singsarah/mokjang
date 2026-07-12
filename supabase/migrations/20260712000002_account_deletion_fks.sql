-- 계정 삭제(auth.users 행 삭제)가 남은 그룹 데이터의 참조에 막히지 않도록
-- ON DELETE 동작이 없던 FK들을 SET NULL로 정리한다.
-- (탈퇴자가 남긴 기록은 유지하되 계정과의 연결만 익명화)

-- groups.created_by: NOT NULL + 동작 없음 → 그룹을 만든 사람이 탈퇴하면 삭제 불가였음.
ALTER TABLE groups ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE groups DROP CONSTRAINT groups_created_by_fkey;
ALTER TABLE groups ADD CONSTRAINT groups_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- memberships.approved_by / removed_by: 다른 교사를 승인·제거한 이력이 있으면 삭제 불가였음.
ALTER TABLE memberships DROP CONSTRAINT memberships_approved_by_fkey;
ALTER TABLE memberships ADD CONSTRAINT memberships_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE memberships DROP CONSTRAINT memberships_removed_by_fkey;
ALTER TABLE memberships ADD CONSTRAINT memberships_removed_by_fkey
  FOREIGN KEY (removed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- attendance_sessions.closed_by: 출석을 마감한 이력이 있으면 삭제 불가였음.
ALTER TABLE attendance_sessions DROP CONSTRAINT attendance_sessions_closed_by_fkey;
ALTER TABLE attendance_sessions ADD CONSTRAINT attendance_sessions_closed_by_fkey
  FOREIGN KEY (closed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
