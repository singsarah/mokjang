-- 진급 연도 가드를 원자적 UPDATE로 교체 (동시 진급 요청 TOCTOU 경합 방지)
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
  -- 원자적 연도 가드: 행 잠금으로 동시 진급 차단. 이미 올해 진급했으면 0행→예외.
  UPDATE public.groups SET last_promoted_year = v_year
    WHERE id = p_group_id AND last_promoted_year IS DISTINCT FROM v_year;
  IF NOT FOUND THEN
    RAISE EXCEPTION '올해 이미 진급했습니다';
  END IF;
  UPDATE public.students SET graduated_at = now()
    WHERE group_id = p_group_id AND grade = 3 AND deleted_at IS NULL AND graduated_at IS NULL;
  UPDATE public.students SET grade = grade + 1
    WHERE group_id = p_group_id AND grade IN (1,2) AND deleted_at IS NULL AND graduated_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_group(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.promote_group(uuid) TO authenticated;
