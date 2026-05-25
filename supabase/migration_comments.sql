-- =============================================================================
-- MindMap — Comments Feature Migration
-- Run this in Supabase SQL Editor
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Create node_comments table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS node_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id     UUID        NOT NULL REFERENCES mindmaps(id) ON DELETE CASCADE,
  node_id    TEXT        NOT NULL,
  text       TEXT        NOT NULL,
  author     TEXT        NOT NULL DEFAULT 'Anonymous',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Grant access
GRANT ALL ON TABLE node_comments TO anon;
GRANT ALL ON TABLE node_comments TO authenticated;
GRANT ALL ON TABLE node_comments TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE node_comments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. RLS Policies (same pattern as mindmaps — USING true, app enforces via filters)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow read comments with valid token" ON node_comments;
DROP POLICY IF EXISTS "Allow insert comment" ON node_comments;
DROP POLICY IF EXISTS "Allow delete own comment" ON node_comments;

-- SELECT: anyone with a valid mindmap token can read comments
CREATE POLICY "Allow read comments with valid token"
  ON node_comments
  FOR SELECT
  TO anon
  USING (true);

-- INSERT: anon can insert (app enforces token via createTokenClient)
CREATE POLICY "Allow insert comment"
  ON node_comments
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- DELETE: anon can delete (app enforces token + ownership checks)
CREATE POLICY "Allow delete comment"
  ON node_comments
  FOR DELETE
  TO anon
  USING (true);

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_node_comments_map_id   ON node_comments (map_id);
CREATE INDEX IF NOT EXISTS idx_node_comments_node_id  ON node_comments (node_id);
CREATE INDEX IF NOT EXISTS idx_node_comments_map_node ON node_comments (map_id, node_id);
