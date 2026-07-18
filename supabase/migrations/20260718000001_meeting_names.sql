-- 모임 이름: 출석 화면 세션 배지에 표시할 이름을 조직 관리에서 설정.
-- meeting_day_names: 요일(0=일…6=토, 키는 문자열)별 정기 모임 이름.
--   예) {"0": "주일예배", "3": "수요모임"} — 비어 있으면 기본값(일=주일예배, 그 외=모임).
ALTER TABLE groups
  ADD COLUMN meeting_day_names jsonb NOT NULL DEFAULT '{}';

-- 임시 모임 이름 — 예) 수련회 1일차. NULL 이면 요일 이름/기본값으로 폴백.
ALTER TABLE extra_meetings
  ADD COLUMN name text;
