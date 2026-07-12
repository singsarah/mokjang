-- 회의록 테이블. 교사 회의 내용을 누적 기록하고 열람.
-- 양식은 날짜+제목+자유 본문(참석자·안건 등은 본문에 자유 기재).
CREATE TABLE meeting_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  meeting_date date NOT NULL,
  content text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_minutes_group_date ON meeting_minutes(group_id, meeting_date DESC);

ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;

-- 조회: 활성 멤버 누구나.
CREATE POLICY "members read meeting minutes" ON meeting_minutes FOR SELECT
  USING (is_active_member(group_id, auth.uid()));

-- 추가/수정/삭제: 편집 권한 이상(master/editor) — 일정·출석과 동일 규칙.
CREATE POLICY "editors write meeting minutes" ON meeting_minutes FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) IN ('master','editor'))
  WITH CHECK (user_role_in_group(group_id, auth.uid()) IN ('master','editor'));
