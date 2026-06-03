/**
 * exportUtils.ts
 *
 * Export helpers for the Connodo canvas.
 *
 * Supported formats (per spec):
 *   PNG  — html-to-image → blob → download
 *   PDF  — html-to-image → jsPDF embed → download
 *   JSON — { title, nodes, edges } → Blob → download
 */

import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { FlowNode, FlowEdge } from './supabase';

// ---------------------------------------------------------------------------
// PNG Export
// ---------------------------------------------------------------------------

/**
 * Exports the React Flow canvas element as a PNG and triggers a browser download.
 *
 * @param canvasElement - The DOM element wrapping the React Flow canvas
 * @param filename      - Download filename (without extension)
 */
export async function exportAsPng(
  canvasElement: HTMLElement,
  filename = 'connodo'
): Promise<void> {
  const dataUrl = await toPng(canvasElement, {
    backgroundColor: '#ffffff',
    pixelRatio: 2, // High-DPI
  });

  triggerDownload(dataUrl, `${filename}.png`);
}

// ---------------------------------------------------------------------------
// PDF Export
// ---------------------------------------------------------------------------

/**
 * Exports the React Flow canvas element as a PDF (PNG embedded into A4 page)
 * and triggers a browser download.
 *
 * @param canvasElement - The DOM element wrapping the React Flow canvas
 * @param filename      - Download filename (without extension)
 */
export async function exportAsPdf(
  canvasElement: HTMLElement,
  filename = 'connodo'
): Promise<void> {
  const dataUrl = await toPng(canvasElement, {
    backgroundColor: '#ffffff',
    pixelRatio: 2,
  });

  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
  });

  const pdf = new jsPDF({
    orientation: img.width > img.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [img.width, img.height],
  });

  pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
  pdf.save(`${filename}.pdf`);
}

// ---------------------------------------------------------------------------
// JSON Export
// ---------------------------------------------------------------------------

/**
 * Serializes the current connodo state to a JSON file and triggers a download.
 *
 * @param title  - Map title
 * @param nodes  - Current React Flow nodes
 * @param edges  - Current React Flow edges
 * @param filename - Download filename (without extension)
 */
export function exportAsJson(
  title: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  filename = 'connodo'
): void {
  const payload = JSON.stringify({ title, nodes, edges }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  triggerDownload(url, `${filename}.json`);

  // Clean up the object URL after the download is triggered
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function triggerDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
