import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const dashboardSource = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');

test('saved mindmap cards build a clear preview from persisted nodes when thumbnail is missing', () => {
  assert.match(
    dashboardSource,
    /nodes:\s*MindMapPreviewNode\[\]/,
    'saved maps should load persisted nodes for dashboard preview rendering',
  );
  assert.match(
    dashboardSource,
    /<MindMapCardPreview\s+nodes=\{map\.nodes\}/,
    'saved cards should render a generated mindmap preview instead of only relying on cached thumbnails',
  );
});

test('recently updated sort select uses a centered custom dropdown arrow', () => {
  assert.match(
    dashboardSource,
    /<div className="relative">[\s\S]*<select[\s\S]*appearance-none[\s\S]*pr-10[\s\S]*Recently updated[\s\S]*<svg[\s\S]*aria-hidden="true"[\s\S]*pointer-events-none[\s\S]*top-1\/2[\s\S]*-translate-y-1\/2/,
    'sort select should replace the native arrow with a vertically centered custom arrow',
  );
});
