-- 교사 명단(teachers) ↔ 가입 계정(auth.users) 연결.
-- 명단은 계정 없이도 존재하므로 nullable. 한 계정은 최대 한 명단 행에만 연결(UNIQUE).
-- 계정이 삭제되면 명단은 남기고 연결만 해제(SET NULL) — 테스트 유저 cleanup에도 안전.
ALTER TABLE teachers
  ADD COLUMN user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
