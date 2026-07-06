CREATE OR REPLACE FUNCTION find_group_by_code(code_input text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM groups WHERE join_code = upper(code_input) LIMIT 1;
$$;

-- Restrict to authenticated users only
REVOKE ALL ON FUNCTION find_group_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_group_by_code(text) TO authenticated;
