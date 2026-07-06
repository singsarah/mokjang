CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  grade int NOT NULL,
  name text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, grade, name)
);

CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  name text NOT NULL,
  grade int NOT NULL,
  birthday_month int,
  birthday_day int,
  birthday_year int,
  phone_self text,
  phone_guardian text,
  guardian_relation text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_group_deleted ON students(group_id, deleted_at);
CREATE INDEX idx_classes_group ON classes(group_id, grade, display_order);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read classes" ON classes FOR SELECT
  USING (is_active_member(group_id, auth.uid()));
CREATE POLICY "members read students" ON students FOR SELECT
  USING (is_active_member(group_id, auth.uid()));

CREATE POLICY "editors write classes" ON classes FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) IN ('master','editor'))
  WITH CHECK (user_role_in_group(group_id, auth.uid()) IN ('master','editor'));
CREATE POLICY "editors write students" ON students FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) IN ('master','editor'))
  WITH CHECK (user_role_in_group(group_id, auth.uid()) IN ('master','editor'));
