-- =============================================================================
-- MindMap MVP — Supabase Database Schema
-- Run this entire file in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to re-run: all statements use IF NOT EXISTS / CREATE OR REPLACE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Enable pgcrypto extension (required for gen_random_uuid on older PG)
--    Supabase projects have this enabled by default, but included for safety.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Create the mindmaps table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mindmaps (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL    DEFAULT 'Untitled Map',
  nodes        JSONB       NOT NULL    DEFAULT '[]',
  edges        JSONB       NOT NULL    DEFAULT '[]',
  view_token   UUID        NOT NULL    DEFAULT gen_random_uuid(),
  edit_token   UUID        NOT NULL    DEFAULT gen_random_uuid(),
  owner_token  UUID        NOT NULL    DEFAULT gen_random_uuid(),
  updated_at   TIMESTAMPTZ NOT NULL    DEFAULT NOW()
);

ALTER TABLE mindmaps
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Grant standard access to all roles so RLS can take over
GRANT ALL ON TABLE mindmaps TO anon;
GRANT ALL ON TABLE mindmaps TO authenticated;
GRANT ALL ON TABLE mindmaps TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Enable Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE mindmaps ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. RLS Policies
--
-- Design note (MVP):
--   Supabase's anon key does not carry per-request JWT claims that contain
--   our custom tokens. The cleanest zero-auth approach is:
--     • Application layer: always appends .eq('<token_col>', token) to every
--       query, so only the matching row is returned/updated.
--     • RLS layer: enforces that a row is only accessible when the correct
--       token column value is supplied in the filter (via USING expression).
--
--   For SELECT we allow any row where at least one token column is present
--   (the app always sends exactly one .eq() filter, so only one row matches).
--   For UPDATE/DELETE the USING expression enforces the token column directly.
--
--   This gives TRUE server-side enforcement: a client that omits the .eq()
--   filter will get 0 rows back on SELECT and 0 rows affected on UPDATE/DELETE,
--   even if they somehow call the REST API directly.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_request_token()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.headers', true)::json->>'x-mindmap-token',
    ''
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN '';
END;
$$ LANGUAGE plpgsql STABLE;

DROP POLICY IF EXISTS "Allow read with any valid token"         ON mindmaps;
DROP POLICY IF EXISTS "Allow insert for anon"                  ON mindmaps;
DROP POLICY IF EXISTS "Allow canvas update with edit token"    ON mindmaps;
DROP POLICY IF EXISTS "Allow title update with owner token"    ON mindmaps;
DROP POLICY IF EXISTS "Allow delete with owner token"          ON mindmaps;

CREATE POLICY "Allow read with any valid token"
  ON mindmaps
  FOR SELECT
  TO anon, authenticated
  USING (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR
    (get_request_token() <> '' AND (
      view_token::text = get_request_token() OR
      edit_token::text = get_request_token() OR
      owner_token::text = get_request_token()
    ))
  );

CREATE POLICY "Allow insert for anon"
  ON mindmaps
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow canvas update with edit token"
  ON mindmaps
  FOR UPDATE
  TO anon, authenticated
  USING (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR
    (get_request_token() <> '' AND (
      edit_token::text = get_request_token() OR
      owner_token::text = get_request_token()
    ))
  )
  WITH CHECK (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR
    (get_request_token() <> '' AND (
      edit_token::text = get_request_token() OR
      owner_token::text = get_request_token()
    ))
  );

CREATE POLICY "Allow title update with owner token"
  ON mindmaps
  FOR UPDATE
  TO anon, authenticated
  USING (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR
    (get_request_token() <> '' AND owner_token::text = get_request_token())
  )
  WITH CHECK (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR
    (get_request_token() <> '' AND owner_token::text = get_request_token())
  );

CREATE POLICY "Allow delete with owner token"
  ON mindmaps
  FOR DELETE
  TO anon, authenticated
  USING (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR
    (get_request_token() <> '' AND owner_token::text = get_request_token())
  );

-- ---------------------------------------------------------------------------
-- 4. Indexes — fast token lookups (O(log n) vs O(n) full scan)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mindmaps_view_token   ON mindmaps (view_token);
CREATE INDEX IF NOT EXISTS idx_mindmaps_edit_token   ON mindmaps (edit_token);
CREATE INDEX IF NOT EXISTS idx_mindmaps_owner_token  ON mindmaps (owner_token);
CREATE INDEX IF NOT EXISTS idx_mindmaps_user_id      ON mindmaps (user_id);

-- ---------------------------------------------------------------------------
-- 5. updated_at auto-update trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger first so CREATE doesn't fail on re-run
DROP TRIGGER IF EXISTS set_updated_at ON mindmaps;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON mindmaps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 6. Verification queries (run after setup to confirm everything is correct)
-- ---------------------------------------------------------------------------
-- Check table columns:
--   SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'mindmaps'
--   ORDER BY ordinal_position;
--
-- Check RLS policies:
--   SELECT policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE tablename = 'mindmaps';
--
-- Check indexes:
--   SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE tablename = 'mindmaps';
--
-- Smoke test — insert a map and verify tokens are generated:
--   INSERT INTO mindmaps DEFAULT VALUES RETURNING id, view_token, edit_token, owner_token;
-- ---------------------------------------------------------------------------
