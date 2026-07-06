-- Let a group's creator SELECT it even before their master membership row
-- exists. createGroup inserts the group and then the membership; the insert's
-- RETURNING/select would otherwise be blocked by the members-only read policy
-- (is_active_member is false until the membership is inserted), which surfaces
-- as a misleading "new row violates row-level security policy" on groups.
DROP POLICY IF EXISTS "members read own groups" ON groups;

CREATE POLICY "members read own groups"
  ON groups FOR SELECT
  USING (is_active_member(id, auth.uid()) OR created_by = auth.uid());
