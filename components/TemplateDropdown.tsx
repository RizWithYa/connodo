'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, useRef } from 'react';
import { TEMPLATES } from '@/lib/templates';
import type { TemplateData } from '@/lib/templates';

interface Props {
  triggerEl: HTMLElement | null;
  onSelectTemplate: (tmpl: TemplateData) => void;
  onClose: () => void;
}

export default function TemplateDropdown({ triggerEl, onSelectTemplate, onClose }: Props) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!triggerEl) return;

    const updatePosition = () => {
      const rect = triggerEl.getBoundingClientRect();
      let top = rect.bottom + 8;
      const left = rect.left;

      if (dropdownRef.current) {
        const dropdownHeight = dropdownRef.current.offsetHeight;
        if (top + dropdownHeight > window.innerHeight) {
          top = rect.top - dropdownHeight - 8;
        }
      }

      setPosition({ top, left });
    };

    // Initial position
    updatePosition();

    // We don't close on scroll, we just update the position so it sticks to the button!
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [triggerEl]);

  // Handle click outside and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (!triggerEl || !dropdownRef.current) return;
      const target = e.target as Node;
      if (!triggerEl.contains(target) && !dropdownRef.current.contains(target)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [triggerEl, onClose]);

  if (!triggerEl) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      id="template-dropdown"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
      }}
      className="bg-[#1e2a4a] dark:bg-[#111844] rounded-xl shadow-2xl border border-[#4B5694]/30 min-w-[240px] flex flex-col divide-y divide-[#4B5694]/20"
    >
      {Object.entries(TEMPLATES).map(([key, tmpl]) => (
        <button
          key={key}
          onClick={() => onSelectTemplate(tmpl)}
          className="w-full text-left px-4 py-3 hover:bg-[#4B5694]/20 transition-colors flex flex-col gap-0.5 first:rounded-t-xl last:rounded-b-xl"
        >
          <div className="text-[#EAE0CF] font-semibold">
            {tmpl.label}
          </div>
          <div className="text-[#7288AE] text-sm">
            {tmpl.description}
          </div>
        </button>
      ))}
    </div>,
    document.body,
  );
}
