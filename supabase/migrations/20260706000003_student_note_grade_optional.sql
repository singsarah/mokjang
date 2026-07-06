-- 학생 폼에서 학년을 필수로 받지 않는다 (반 중심 편성). grade는 nullable로.
-- 선생님이 학생에 대해 남기는 자유 메모(note) 컬럼 추가.
ALTER TABLE students ALTER COLUMN grade DROP NOT NULL;
ALTER TABLE students ADD COLUMN note text;
