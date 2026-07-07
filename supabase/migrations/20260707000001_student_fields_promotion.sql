ALTER TABLE students ADD COLUMN gender text CHECK (gender IN ('male','female'));
ALTER TABLE students ADD COLUMN graduated_at timestamptz;
ALTER TABLE groups ADD COLUMN last_promoted_year int;

CREATE INDEX idx_students_group_graduated ON students(group_id, graduated_at);

-- 진급: 전체 학년 +1, 3학년 졸업, master만, 같은 해 1회. 원자적.
CREATE OR REPLACE FUNCTION public.promote_group(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_year int := extract(year from now())::int;
BEGIN
  IF public.user_role_in_group(p_group_id, auth.uid()) IS DISTINCT FROM 'master' THEN
    RAISE EXCEPTION '진급은 대표 교사만 할 수 있습니다';
  END IF;
  IF (SELECT last_promoted_year FROM public.groups WHERE id = p_group_id) = v_year THEN
    RAISE EXCEPTION '올해 이미 진급했습니다';
  END IF;
  UPDATE public.students SET graduated_at = now()
    WHERE group_id = p_group_id AND grade = 3 AND deleted_at IS NULL AND graduated_at IS NULL;
  UPDATE public.students SET grade = grade + 1
    WHERE group_id = p_group_id AND grade IN (1,2) AND deleted_at IS NULL AND graduated_at IS NULL;
  UPDATE public.groups SET last_promoted_year = v_year WHERE id = p_group_id;
END;
$$;
