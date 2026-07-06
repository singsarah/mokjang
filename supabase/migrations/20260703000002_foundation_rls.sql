-- === Enable RLS on foundation tables ===
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- === Helper: is the user an active member of this group? ===
CREATE OR REPLACE FUNCTION is_active_member(gid uuid, uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE group_id = gid AND user_id = uid AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION user_role_in_group(gid uuid, uid uuid)
RETURNS role_type LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM memberships
  WHERE group_id = gid AND user_id = uid AND status = 'active'
  LIMIT 1;
$$;

-- === groups ===
CREATE POLICY "members read own groups"
  ON groups FOR SELECT
  USING (is_active_member(id, auth.uid()));

-- Anyone signed in can INSERT (needed for group creation); trigger sets them as master via memberships.
CREATE POLICY "signed-in users can create groups"
  ON groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "master can update group"
  ON groups FOR UPDATE
  USING (user_role_in_group(id, auth.uid()) = 'master');

-- No DELETE policy — groups are never deleted from the app (only archived, in a later plan).

-- === profiles ===
CREATE POLICY "read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "read profiles of groupmates"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m1
      JOIN memberships m2 ON m1.group_id = m2.group_id
      WHERE m1.user_id = auth.uid() AND m1.status = 'active'
        AND m2.user_id = profiles.id AND m2.status IN ('active', 'pending')
    )
  );

CREATE POLICY "update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- === memberships ===
CREATE POLICY "read memberships in own groups"
  ON memberships FOR SELECT
  USING (
    user_id = auth.uid()  -- own memberships (any status)
    OR is_active_member(group_id, auth.uid())  -- others' if active in that group
  );

CREATE POLICY "join group (create pending membership for self)"
  ON memberships FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      -- Master creation path: user is creating a master membership for a group they just created
      (role = 'master' AND status = 'active'
       AND EXISTS (SELECT 1 FROM groups WHERE id = group_id AND created_by = auth.uid()))
      OR
      -- Regular join path: self-inserting a pending membership
      (status = 'pending')
    )
  );

CREATE POLICY "master can update memberships in own group"
  ON memberships FOR UPDATE
  USING (user_role_in_group(group_id, auth.uid()) = 'master');

-- === audit_log ===
CREATE POLICY "read own group's audit log"
  ON audit_log FOR SELECT
  USING (group_id IS NULL OR is_active_member(group_id, auth.uid()));

-- Audit inserts happen from server actions (service role) or via triggers — no user INSERT policy.
