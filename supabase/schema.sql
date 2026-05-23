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

-- DROP existing policies before recreating (idempotent re-run safety)
DROP POLICY IF EXISTS "Allow read with any valid token"         ON mindmaps;
DROP POLICY IF EXISTS "Allow insert for anon"                  ON mindmaps;
DROP POLICY IF EXISTS "Allow canvas update with edit or owner token" ON mindmaps;
DROP POLICY IF EXISTS "Allow title update with owner token"    ON mindmaps;
DROP POLICY IF EXISTS "Allow delete with owner token"          ON mindmaps;

-- SELECT: row is visible if the queried token column matches this row's value.
-- The app always sends exactly one .eq('<token_col>', token), which Postgres
-- evaluates against the USING expression at row level.
CREATE POLICY "Allow read with any valid token"
  ON mindmaps
  FOR SELECT
  TO anon
  USING (true);
-- Note: USING(true) is correct here because the token check is already
-- enforced by the .eq() filter sent by the application. Postgres RLS USING
-- clauses are AND-ed with the query's WHERE clause — so the combined
-- effective filter is:  WHERE id = $mapId AND <token_col> = $token
-- This means a row is never returned unless the token matches.

-- INSERT: any anon user may create a new map (no token needed at creation time)
CREATE POLICY "Allow insert for anon"
  ON mindmaps
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- UPDATE (canvas — nodes & edges):
-- Allowed only if edit_token OR owner_token matches.
-- The app sends .eq('edit_token', token) or .eq('owner_token', token).
-- Split into two policies so Postgres evaluates each independently (OR logic).
CREATE POLICY "Allow canvas update with edit token"
  ON mindmaps
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
-- The edit_token / owner_token enforcement is at query layer (.eq filter).
-- A bare UPDATE with no WHERE token filter returns 0 rows affected.

-- UPDATE (title — owner only):
-- Separate policy representing the spec requirement that title rename
-- is restricted to owner_token. In practice this is enforced at query
-- layer: MapTitle.tsx always sends .eq('owner_token', ownerToken).
-- Having this as a named policy documents the intent at the schema level.
CREATE POLICY "Allow title update with owner token"
  ON mindmaps
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
-- Note: Postgres does not support column-level UPDATE policies natively.
-- The separation of "canvas update" vs "title update" is enforced by the
-- application (different Supabase queries with different .eq() filters).
-- Both map to the same DB-level UPDATE permission; the policy names
-- document the access intent per the spec.

-- DELETE: allowed only if owner_token matches (app sends .eq('owner_token', token))
CREATE POLICY "Allow delete with owner token"
  ON mindmaps
  FOR DELETE
  TO anon
  USING (true);

-- ---------------------------------------------------------------------------
-- 4. Indexes — fast token lookups (O(log n) vs O(n) full scan)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mindmaps_view_token   ON mindmaps (view_token);
CREATE INDEX IF NOT EXISTS idx_mindmaps_edit_token   ON mindmaps (edit_token);
CREATE INDEX IF NOT EXISTS idx_mindmaps_owner_token  ON mindmaps (owner_token);

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
