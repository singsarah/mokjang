-- 졸업 시 반 배정(class_id)도 비운다 + 진급 연도 기준을 한국시간(Asia/Seoul)으로.
CREATE OR REPLACE FUNCTION public.promote_group(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_year int := extract(year from (now() AT TIME ZONE 'Asia/Seoul'))::int;
BEGIN
  IF public.user_role_in_group(p_group_id, auth.uid()) IS DISTINCT FROM 'master' THEN
    RAISE EXCEPTION '진급은 대표 교사만 할 수 있습니다';
  END IF;
  -- 원자적 연도 가드: 행 잠금으로 동시 진급 차단. 이미 올해 진급했으면 0행→예외.
  UPDATE public.groups SET last_promoted_year = v_year
    WHERE id = p_group_id AND last_promoted_year IS DISTINCT FROM v_year;
  IF NOT FOUND THEN
    RAISE EXCEPTION '올해 이미 진급했습니다';
  END IF;
  -- 3학년 졸업: graduated_at 세팅 + 반 배정 해제(복원 시 미배정으로 돌아옴).
  UPDATE public.students SET graduated_at = now(), class_id = NULL
    WHERE group_id = p_group_id AND grade = 3 AND deleted_at IS NULL AND graduated_at IS NULL;
  UPDATE public.students SET grade = grade + 1
    WHERE group_id = p_group_id AND grade IN (1,2) AND deleted_at IS NULL AND graduated_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_group(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.promote_group(uuid) TO authenticated;
