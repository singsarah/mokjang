-- 반을 학년에 고정하지 않고 자유 이름으로 만든다 (1~3학년 통합반 등 지원).
-- classes.grade 제거. 학생 개개인의 grade(students.grade)는 그대로 유지.
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_group_id_grade_name_key;
DROP INDEX IF EXISTS idx_classes_group;
ALTER TABLE classes DROP COLUMN IF EXISTS grade;
ALTER TABLE classes ADD CONSTRAINT classes_group_id_name_key UNIQUE (group_id, name);
CREATE INDEX idx_classes_group ON classes(group_id, display_order);
