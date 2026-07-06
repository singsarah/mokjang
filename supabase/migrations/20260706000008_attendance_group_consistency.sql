-- attendance_records.group_id 가 세션/학생의 실제 그룹과 일치하도록 DB에서 강제.
CREATE OR REPLACE FUNCTION check_attendance_record_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s_group uuid;
  st_group uuid;
BEGIN
  SELECT group_id INTO s_group FROM public.attendance_sessions WHERE id = NEW.session_id;
  SELECT group_id INTO st_group FROM public.students WHERE id = NEW.student_id;
  IF s_group IS NULL OR st_group IS NULL OR NEW.group_id <> s_group OR NEW.group_id <> st_group THEN
    RAISE EXCEPTION 'attendance_records.group_id must match its session and student group';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attendance_record_group
  BEFORE INSERT OR UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION check_attendance_record_group();
