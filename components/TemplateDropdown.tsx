'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { TEMPLATES } from '@/lib/templates';
import type { TemplateData } from '@/lib/templates';

interface Props {
  triggerEl: HTMLElement | null;
  onSelectTemplate: (tmpl: TemplateData) => void;
  onClose: () => void;
}

export default function TemplateDropdown({ triggerEl, onSelectTemplate, onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on scroll or resize
  useEffect(() => {
    const handleScroll = (e: Event) => {
      // Don't close if scrolling inside the dropdown itself
      if ((e.target as HTMLElement)?.closest?.('#template-dropdown')) return;
      onClose();
    };
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  if (!triggerEl) return null;

  const rect = triggerEl.getBoundingClientRect();

  // Calculate position to avoid clipping at screen edges
  const dropdownWidth = 260;
  const leftPos = Math.min(rect.left, window.innerWidth - dropdownWidth - 16);

  return createPortal(
    <div
      id="template-dropdown"
      style={{
        position: 'fixed',
        top: rect.bottom + 8,
        left: leftPos,
        zIndex: 9999,
        width: dropdownWidth,
      }}
      className={`
        bg-white/95 backdrop-blur-xl border border-slate-200/60 shadow-2xl rounded-2xl p-2.5
        transition-all duration-200 ease-out origin-top-left
        max-h-[60vh] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent
        ${mounted ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'}
      `}
    >
      <div className="mb-2 px-2 pt-1 text-xs font-bold tracking-wider text-slate-400 uppercase">
        Quick Start
      </div>
      <div className="flex flex-col gap-1">
        {Object.entries(TEMPLATES).map(([key, tmpl]) => (
          <button
            key={key}
            onClick={() => onSelectTemplate(tmpl)}
            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-100/80 transition-all duration-150 flex items-start gap-3 group active:scale-[0.98]"
          >
            <div className="mt-0.5 flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0">
              {key === 'brainstorm' && '🧠'}
              {key === 'project' && '📋'}
              {key === 'swot' && '🎯'}
              {key === 'meeting' && '🤝'}
              {key === 'learning' && '📚'}
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="text-slate-700 text-sm font-semibold group-hover:text-slate-900 transition-colors">
                {tmpl.label}
              </div>
              <div className="text-slate-400 text-[11px] leading-snug group-hover:text-slate-500 transition-colors">
                {tmpl.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
