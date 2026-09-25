'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface MapTitleProps {
  mapId: string;
  initialTitle: string;
  /** Only owner may edit; others see read-only title */
  canRename: boolean;
  /** The owner_token — required to authorise the UPDATE via RLS */
  ownerToken: string | null;
}

/**
 * MapTitle — inline-editable map title shown above the canvas.
 *
 * Behaviour (per spec):
 *  - Owner: click / focus to edit; Enter or blur → save to Supabase
 *  - Editor / Viewer: title is displayed read-only
 *  - Optimistic update: title changes immediately in UI; reverts on error
 */
export default function MapTitle({
  mapId,
  initialTitle,
  canRename,
  ownerToken,
}: MapTitleProps) {
  const [title, setTitle] = useState(initialTitle || 'Untitled Map');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep in sync if parent re-fetches title
  useEffect(() => {
    setTitle(initialTitle || 'Untitled Map');
    setDraft(initialTitle || 'Untitled Map');
  }, [initialTitle]);

  // Auto-focus input when editing starts
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function commitSave(value: string) {
    const trimmed = value.trim() || 'Untitled Map';
    setEditing(false);

    if (trimmed === title) return; // nothing changed

    // Optimistic update
    setTitle(trimmed);
    setSaving(true);

    try {
      const { error } = await supabase
        .from('mindmaps')
        .update({ title: trimmed })
        .eq('id', mapId)
        .eq('owner_token', ownerToken ?? '');

      if (error) {
        console.error('Failed to save title:', error);
        // Revert on error
        setTitle(title);
        setDraft(title);
      } else {
        setDraft(trimmed);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitSave(draft);
    } else if (e.key === 'Escape') {
      setDraft(title);
      setEditing(false);
    }
  }

  if (!canRename) {
    // Read-only display for editor / viewer
    return (
      <div className="flex items-center px-4 py-2 border-b bg-white shrink-0 h-10">
        <span className="text-sm font-semibold text-slate-700 truncate max-w-xs">
          {title}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-white shrink-0 h-10">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitSave(draft)}
          onKeyDown={handleKeyDown}
          className="text-sm font-semibold text-slate-800 bg-transparent border-b-2 border-blue-400 outline-none w-full max-w-xs focus:max-w-sm transition-all"
          maxLength={100}
          aria-label="Map title"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(title);
            setEditing(true);
          }}
          className="text-sm font-semibold text-slate-800 hover:text-blue-600 truncate max-w-xs cursor-text text-left group flex items-center gap-1.5"
          title="Click to rename"
        >
          {title}
          <Pencil className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
        </button>
      )}

      {saving && (
        <span className="text-xs text-slate-400 animate-pulse shrink-0">
          Saving…
        </span>
      )}
    </div>
  );
}
