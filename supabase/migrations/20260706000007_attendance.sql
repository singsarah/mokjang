CREATE TABLE attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, session_date)
);

CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present','absent_with_reason','unconfirmed')),
  reason text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);

CREATE INDEX idx_att_sessions_group_date ON attendance_sessions(group_id, session_date);
CREATE INDEX idx_att_records_session ON attendance_records(session_id);
CREATE INDEX idx_att_records_group_student ON attendance_records(group_id, student_id);

ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read att sessions" ON attendance_sessions FOR SELECT
  USING (is_active_member(group_id, auth.uid()));
CREATE POLICY "editors write att sessions" ON attendance_sessions FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) IN ('master','editor'))
  WITH CHECK (user_role_in_group(group_id, auth.uid()) IN ('master','editor'));

CREATE POLICY "members read att records" ON attendance_records FOR SELECT
  USING (is_active_member(group_id, auth.uid()));
CREATE POLICY "editors write att records" ON attendance_records FOR ALL
  USING (user_role_in_group(group_id, auth.uid()) IN ('master','editor'))
  WITH CHECK (user_role_in_group(group_id, auth.uid()) IN ('master','editor'));
