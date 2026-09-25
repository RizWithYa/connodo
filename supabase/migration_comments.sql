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
DROP POLICY IF EXISTS "Allow delete comment" ON node_comments;
DROP POLICY IF EXISTS "Allow delete own comment" ON node_comments;

CREATE POLICY "Allow read comments with valid token"
  ON node_comments
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mindmaps
      WHERE mindmaps.id = node_comments.map_id
      AND (
        (mindmaps.user_id IS NOT NULL AND auth.uid() = mindmaps.user_id) OR
        (get_request_token() <> '' AND (
          mindmaps.view_token::text = get_request_token() OR
          mindmaps.edit_token::text = get_request_token() OR
          mindmaps.owner_token::text = get_request_token()
        ))
      )
    )
  );

CREATE POLICY "Allow insert comment"
  ON node_comments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mindmaps
      WHERE mindmaps.id = node_comments.map_id
      AND (
        (mindmaps.user_id IS NOT NULL AND auth.uid() = mindmaps.user_id) OR
        (get_request_token() <> '' AND (
          mindmaps.edit_token::text = get_request_token() OR
          mindmaps.owner_token::text = get_request_token()
        ))
      )
    )
  );

CREATE POLICY "Allow delete comment"
  ON node_comments
  FOR DELETE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM mindmaps
      WHERE mindmaps.id = node_comments.map_id
      AND (
        (mindmaps.user_id IS NOT NULL AND auth.uid() = mindmaps.user_id) OR
        (get_request_token() <> '' AND mindmaps.owner_token::text = get_request_token())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_node_comments_map_id   ON node_comments (map_id);
CREATE INDEX IF NOT EXISTS idx_node_comments_node_id  ON node_comments (node_id);
CREATE INDEX IF NOT EXISTS idx_node_comments_map_node ON node_comments (map_id, node_id);
