-- === Foundation tables ===
-- No RLS in this migration — see 20260703000002_foundation_rls.sql

CREATE TYPE role_type AS ENUM ('master', 'editor', 'viewer');
CREATE TYPE membership_status AS ENUM ('pending', 'active', 'removed');

CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  join_code text NOT NULL UNIQUE CHECK (join_code ~ '^[A-Z0-9]{8}$'),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  avatar_url text,
  birthday_month int CHECK (birthday_month BETWEEN 1 AND 12),
  birthday_day int CHECK (birthday_day BETWEEN 1 AND 31),
  privacy_consent_at timestamptz,  -- NULL until user accepts privacy policy
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role role_type NOT NULL,
  status membership_status NOT NULL DEFAULT 'pending',
  invited_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  removed_at timestamptz,
  removed_by uuid REFERENCES auth.users(id),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_memberships_user_status ON memberships(user_id, status);
CREATE INDEX idx_memberships_group_status ON memberships(group_id, status);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,   -- e.g. 'member_approved', 'role_changed'
  target_id uuid,
  target_type text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_group_time ON audit_log(group_id, created_at DESC);

-- Auto-create profile row on new auth.users
CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_profile_on_signup();
