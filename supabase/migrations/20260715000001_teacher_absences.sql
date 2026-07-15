-- 교사 출타(출장·여행 등으로 예배 불참) 기간 — 달력에 이름 칩으로 표시.
-- 소유자 = teachers.id (명단 기준): 계정 없는 명단 교사도 마스터가 대신 등록 가능.
-- 본인 여부는 teachers.user_id 계정 연결(마이그레이션 20260710000002)로 판정.
CREATE TABLE teacher_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_date <= end_date),
  -- 달력 렌더 폭주 방지: 출타는 최대 1년.
  CHECK (end_date - start_date < 370)
);

-- 월 범위 겹침 조회(start_date <= 월말 AND end_date >= 월초) 대상 인덱스.
CREATE INDEX idx_teacher_absences_group_dates
  ON teacher_absences(group_id, start_date, end_date);

-- group_id가 교사의 실제 그룹과 일치하도록 강제 (attendance_group_consistency 패턴).
CREATE OR REPLACE FUNCTION check_teacher_absence_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t_group uuid;
BEGIN
  SELECT group_id INTO t_group FROM public.teachers WHERE id = NEW.teacher_id;
  IF t_group IS NULL OR NEW.group_id <> t_group THEN
    RAISE EXCEPTION 'teacher_absences.group_id must match the teacher''s group';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_teacher_absence_group
  BEFORE INSERT OR UPDATE ON teacher_absences
  FOR EACH ROW EXECUTE FUNCTION check_teacher_absence_group();

-- 본인 판정: 이 teacher 명단 행이 내 계정에 연결돼 있는가.
CREATE OR REPLACE FUNCTION is_teacher_self(tid uuid, uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t WHERE t.id = tid AND t.user_id = uid
  );
$$;

ALTER TABLE teacher_absences ENABLE ROW LEVEL SECURITY;

-- 조회: 활성 멤버 누구나 (달력 표시용).
CREATE POLICY "members read teacher absences" ON teacher_absences FOR SELECT
  USING (is_active_member(group_id, auth.uid()));

-- 쓰기: 본인(명단 연결 계정 — viewer 포함) 또는 마스터.
-- USING(기존 행) + WITH CHECK(새 행) 둘 다 걸어, 본인 행을 남의 teacher_id로
-- 바꿔치기하는 UPDATE도 차단. is_active_member 조건은 탈퇴 후에도
-- teachers.user_id 링크가 남아 있는 경우의 쓰기를 막는다.
CREATE POLICY "self or master write teacher absences" ON teacher_absences FOR ALL
  USING (
    is_active_member(group_id, auth.uid())
    AND (
      is_teacher_self(teacher_id, auth.uid())
      OR user_role_in_group(group_id, auth.uid()) = 'master'
    )
  )
  WITH CHECK (
    is_active_member(group_id, auth.uid())
    AND (
      is_teacher_self(teacher_id, auth.uid())
      OR user_role_in_group(group_id, auth.uid()) = 'master'
    )
  );
