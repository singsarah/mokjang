-- 출석 마감(closed_at): 마감된 세션만 통계·엑셀에 포함되고, 마감 후에는 기록이 잠긴다.
--   * closed_at IS NULL  = 임시(draft) — 자유롭게 수정·삭제 가능
--   * closed_at NOT NULL = 마감 — 기록 변경 불가, closed_at 변경(마감 해제)은 마스터만, 삭제 불가
-- auth.uid()가 NULL인 컨텍스트(서비스롤·관리 연결·테스트 cleanup의 CASCADE 삭제)는 가드를 통과시킨다.

ALTER TABLE attendance_sessions
  ADD COLUMN closed_at timestamptz,
  ADD COLUMN closed_by uuid REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION guard_closed_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.closed_at IS NOT NULL THEN
      RAISE EXCEPTION 'closed attendance session cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  -- UPDATE: 이미 마감된 세션의 closed_at 변경(해제·재설정)은 마스터만
  IF OLD.closed_at IS NOT NULL AND NEW.closed_at IS DISTINCT FROM OLD.closed_at
     AND public.user_role_in_group(OLD.group_id, auth.uid()) IS DISTINCT FROM 'master' THEN
    RAISE EXCEPTION 'only a master can reopen a closed attendance session';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION guard_closed_session_records()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_session uuid;
  v_closed timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN v_session := OLD.session_id; ELSE v_session := NEW.session_id; END IF;
  SELECT closed_at INTO v_closed FROM public.attendance_sessions WHERE id = v_session;
  IF v_closed IS NOT NULL THEN
    RAISE EXCEPTION 'attendance session is closed';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER trg_guard_closed_session
  BEFORE UPDATE OR DELETE ON attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION guard_closed_session();

CREATE TRIGGER trg_guard_closed_session_records
  BEFORE INSERT OR UPDATE OR DELETE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION guard_closed_session_records();
