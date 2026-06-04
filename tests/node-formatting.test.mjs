import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const canvasSource = readFileSync(new URL('../components/MindMapCanvas.tsx', import.meta.url), 'utf8');
const nodeEditorSource = readFileSync(new URL('../components/NodeEditor.tsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');

test('node data supports persisted text color and text style flags', () => {
  for (const field of ['textColor?: string', 'bold?: boolean', 'italic?: boolean', 'underline?: boolean']) {
    assert.match(canvasSource, new RegExp(field.replace('?', '\\?')), `MindMapNodeData should include ${field}`);
  }
});

test('editable node toolbar exposes text color, bold, italic, and underline controls separately from background color', () => {
  assert.match(canvasSource, /TEXT_COLORS/, 'toolbar should define text color choices separate from node background colors');
  assert.match(canvasSource, /handleTextColorChange/, 'toolbar should update text color separately from background color');
  assert.match(canvasSource, /\['bold', 'B'\]/, 'toolbar should include bold toggle');
  assert.match(canvasSource, /\['italic', 'I'\]/, 'toolbar should include italic toggle');
  assert.match(canvasSource, /\['underline', 'U'\]/, 'toolbar should include underline toggle');
  assert.match(canvasSource, /handleTextStyleToggle\(style\)/, 'toolbar style buttons should call the text style toggle handler');
});

test('node editor applies persisted text formatting in edit and read-only display modes', () => {
  assert.match(nodeEditorSource, /textColor\?: string/, 'NodeEditor should accept textColor');
  assert.match(nodeEditorSource, /fontWeight: bold \? '700' : undefined/, 'NodeEditor should apply bold font weight');
  assert.match(nodeEditorSource, /fontStyle: italic \? 'italic' : undefined/, 'NodeEditor should apply italic font style');
  assert.match(nodeEditorSource, /textDecoration: underline \? 'underline' : undefined/, 'NodeEditor should apply underline decoration');
});

test('dashboard generated previews render all nodes and their text formatting instead of cached cropped thumbnails', () => {
  assert.doesNotMatch(dashboardSource, /map\.thumbnail \?/, 'dashboard cards should not prefer cached cropped thumbnails over generated full-map previews');
  assert.match(dashboardSource, /preserveAspectRatio="xMidYMid meet"/, 'preview SVG should fit the full mindmap in the card');
  assert.match(dashboardSource, /fontStyle=\{italic \? 'italic' : undefined\}/, 'preview should render italic labels');
  assert.match(dashboardSource, /textDecoration=\{underline \? 'underline' : undefined\}/, 'preview should render underlined labels');
});
