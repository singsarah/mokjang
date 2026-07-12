-- audit_log 읽기 정책 강화: group_id IS NULL 행을 모든 인증 유저가 읽을 수 있던
-- 잠재 구멍 제거 (현재 그런 행을 쓰는 코드는 없음 — 다조직 확장 대비 선제 차단).
DROP POLICY "read own group's audit log" ON audit_log;
CREATE POLICY "read own group's audit log"
  ON audit_log FOR SELECT
  USING (group_id IS NOT NULL AND is_active_member(group_id, auth.uid()));
