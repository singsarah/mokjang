-- 조직 관리: 정기 모임 요일 + 임시 모임 날짜.
-- meeting_days: 0=일요일 … 6=토요일 (JS Date.getDay 규약). 빈 배열이면 미설정 —
-- 출석 화면은 기존처럼 매일 이동(하위 호환).
ALTER TABLE groups
  ADD COLUMN meeting_days smallint[] NOT NULL DEFAULT '{}'
  CHECK (meeting_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]);

-- 임시(비정기) 모임 날짜 — 정기 요일 외에 그때그때 추가하는 모임.
CREATE TABLE extra_meetings (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  meeting_date date NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, meeting_date)
);

ALTER TABLE extra_meetings ENABLE ROW LEVEL SECURITY;

-- 조회: 활성 멤버 누구나 (출석 화면의 날짜 이동 계산에 필요).
CREATE POLICY "members read extra meetings" ON extra_meetings FOR SELECT
  USING (is_active_member(group_id, auth.uid()));

-- 추가/삭제: 마스터만 — 모임 요일 설정(groups UPDATE)과 동일 권한.
CREATE POLICY "master writes extra meetings" ON extra_meetings FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) = 'master')
  WITH CHECK (user_role_in_group(group_id, auth.uid()) = 'master');
