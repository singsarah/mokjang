-- 학생 학교, 보호자 관계 '기타' 상세.
ALTER TABLE students ADD COLUMN school text;
ALTER TABLE students ADD COLUMN guardian_relation_other text;
