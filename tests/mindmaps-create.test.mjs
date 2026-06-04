import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const pageSource = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const createBlock = pageSource.slice(
  pageSource.indexOf('async function handleCreate'),
  pageSource.indexOf('// Delete a map from Supabase + localStorage'),
);

test('authenticated create includes the owner user_id in the mindmaps insert payload', () => {
  assert.match(
    createBlock,
    /const\s+insertData:\s+Record<string,\s*unknown>\s*=\s*\{[\s\S]*owner_token:\s*newOwnerToken[\s\S]*\};/,
    'create should build a reusable insertData object before inserting',
  );
  assert.match(
    createBlock,
    /if\s*\(session\)\s*\{\s*insertData\.user_id\s*=\s*session\.user\.id;\s*\}/,
    'authenticated create must insert user_id so ownership RLS accepts the new row',
  );
});

test('mindmaps schema stores optional owner user_id for authenticated maps', () => {
  assert.match(
    schemaSource,
    /ALTER TABLE mindmaps\s+ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth\.users\(id\) ON DELETE SET NULL;/,
    'schema should define user_id used by authenticated create/list/migration paths',
  );
});

test('mindmaps schema drops every policy it creates before recreating policies', () => {
  const droppedPolicies = new Set(
    [...schemaSource.matchAll(/DROP POLICY IF EXISTS "([^"]+)"\s+ON mindmaps;/g)].map(
      ([, policyName]) => policyName,
    ),
  );
  const createdPolicies = [
    ...schemaSource.matchAll(/CREATE POLICY "([^"]+)"\s+ON mindmaps/g),
  ].map(([, policyName]) => policyName);

  assert.deepEqual(
    createdPolicies.filter((policyName) => !droppedPolicies.has(policyName)),
    [],
    'every created mindmaps policy should have a matching DROP POLICY IF EXISTS statement',
  );
});

test('mindmaps RLS policies apply to both anonymous and authenticated clients', () => {
  for (const policyName of [
    'Allow read with any valid token',
    'Allow insert for anon',
    'Allow canvas update with edit token',
    'Allow title update with owner token',
    'Allow delete with owner token',
  ]) {
    const policyPattern = new RegExp(
      `CREATE POLICY "${policyName}"[\\s\\S]*?TO anon, authenticated`,
    );
    assert.match(
      schemaSource,
      policyPattern,
      `${policyName} should allow the authenticated role as well as anon`,
    );
  }
});
