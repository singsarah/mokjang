-- 일정(캘린더) 테이블. 그룹의 행사·모임 일정을 관리.
-- source='manual'은 직접 입력, 'import'는 이미지/PDF/엑셀에서 AI 추출로 가져온 일정.
-- (설계 스펙엔 'ocr'로 적혀 있으나 실제 구현은 AI 추출 기반이라 'import'로 합의함.)
CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_date date NOT NULL,
  event_time time,
  description text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','import')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_events_group_date ON calendar_events(group_id, event_date);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- 조회: 활성 멤버 누구나.
CREATE POLICY "members read calendar events" ON calendar_events FOR SELECT
  USING (is_active_member(group_id, auth.uid()));

-- 추가/수정/삭제: 편집 권한 이상(master/editor) — 출석 테이블과 동일 규칙.
CREATE POLICY "editors write calendar events" ON calendar_events FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) IN ('master','editor'))
  WITH CHECK (user_role_in_group(group_id, auth.uid()) IN ('master','editor'));
