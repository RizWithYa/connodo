'use client';

import { useEffect, useRef, useState, KeyboardEvent } from 'react';

interface NodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** When true the input is shown immediately in edit mode */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

/**
 * NodeEditor — inline text label for a React Flow node.
 *
 * Behaviour:
 *   - Display mode: shows label as plain text, cursor is default
 *   - Edit mode (double-click activates): auto-focused textarea, auto-sizes to content
 *   - Pressing Enter or Escape commits the edit and exits edit mode
 *   - In readOnly mode the input is never shown
 */
export default function NodeEditor({
  value,
  onChange,
  readOnly = false,
  textColor = '#1e293b',
  bold = false,
  italic = false,
  underline = false,
  editing = false,
  onEditingChange,
}: NodeEditorProps) {
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textStyle = {
    color: textColor,
    fontWeight: bold ? '700' : undefined,
    fontStyle: italic ? 'italic' : undefined,
    textDecoration: underline ? 'underline' : undefined,
  };

  // Sync draft when value changes from outside
  useEffect(() => {
    setDraft(value);
  }, [value]);

  // Auto-focus + select-all when entering edit mode
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [draft]);

  function commit() {
    const trimmed = draft.trim() || 'Node';
    setDraft(trimmed);
    onChange?.(trimmed);
    onEditingChange?.(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Escape') {
      setDraft(value); // revert
      onEditingChange?.(false);
    }
    // Stop React Flow from consuming keystrokes while editing
    e.stopPropagation();
  }

  if (readOnly) {
    return (
      <div className="px-3 py-2 min-w-[80px] max-w-[200px] text-sm font-medium text-center break-words leading-snug" style={textStyle}>
        {value || 'Node'}
      </div>
    );
  }

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        rows={1}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        // Prevent React Flow drag/select from firing on the textarea
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="resize-none bg-transparent outline-none text-center text-sm font-medium w-full min-w-[80px] max-w-[200px] leading-snug overflow-hidden"
        style={{ ...textStyle, height: 'auto' }}
      />
    );
  }

  return (
    <div className="px-3 py-2 min-w-[80px] max-w-[200px] text-sm font-medium text-center break-words leading-snug select-none" style={textStyle}>
      {value || 'Node'}
    </div>
  );
}
