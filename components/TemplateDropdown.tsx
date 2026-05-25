'use client';

import { createPortal } from 'react-dom';
import { TEMPLATES } from '@/lib/templates';
import type { TemplateData } from '@/lib/templates';

interface Props {
  triggerEl: HTMLElement | null;
  onSelectTemplate: (tmpl: TemplateData) => void;
}

export default function TemplateDropdown({ triggerEl, onSelectTemplate }: Props) {
  if (!triggerEl) return null;

  const rect = triggerEl.getBoundingClientRect();

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 9999,
      }}
      className="bg-mindmap-bg-primary border border-mindmap-border/30 rounded-lg p-2 min-w-[220px] shadow-2xl dark:bg-[#111844]"
    >
      {Object.entries(TEMPLATES).map(([key, tmpl]) => (
        <button
          key={key}
          onClick={() => onSelectTemplate(tmpl)}
          className="w-full text-left px-3 py-2 rounded hover:bg-mindmap-accent/30 transition-colors duration-150 flex flex-col gap-0.5 group"
        >
          <div className="text-mindmap-text-primary text-sm font-medium group-hover:text-white transition-colors">
            {tmpl.label}
          </div>
          <div className="text-mindmap-text-muted text-xs group-hover:text-[#93a5cf] transition-colors">
            {tmpl.description}
          </div>
        </button>
      ))}
    </div>,
    document.body,
  );
}
