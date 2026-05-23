'use client';

import { useState } from 'react';
import { buildShareLinks } from '@/lib/tokenUtils';

interface SharePanelProps {
  mapId: string;
  viewToken: string;
  editToken: string;
  ownerToken: string;
  onClose: () => void;
  /** Called after a successful delete — caller should redirect */
  onDelete: () => void;
}

/**
 * SharePanel — modal shown to owners only.
 *
 * Per spec:
 *   - View link  → copy button
 *   - Edit link  → copy button
 *   - Owner link → copy button + "Keep this private" warning
 *   - Delete Map → confirmation dialog → onDelete()
 */
export default function SharePanel({
  mapId,
  viewToken,
  editToken,
  ownerToken,
  onClose,
  onDelete,
}: SharePanelProps) {
  const { viewUrl, editUrl, ownerUrl } = buildShareLinks(
    mapId,
    viewToken,
    editToken,
    ownerToken
  );

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleCopy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Share Map</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Link rows */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {/* View link */}
          <LinkRow
            label="View link"
            description="Anyone with this link can view the map"
            url={viewUrl}
            linkKey="view"
            copiedKey={copiedKey}
            onCopy={handleCopy}
          />

          {/* Edit link */}
          <LinkRow
            label="Edit link"
            description="Anyone with this link can edit the canvas"
            url={editUrl}
            linkKey="edit"
            copiedKey={copiedKey}
            onCopy={handleCopy}
          />

          {/* Owner link — with warning */}
          <div className="flex flex-col gap-1.5">
            <LinkRow
              label="Owner link"
              description="Full access: edit, rename, delete"
              url={ownerUrl}
              linkKey="owner"
              copiedKey={copiedKey}
              onCopy={handleCopy}
              variant="warning"
            />
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-amber-500 text-sm">⚠️</span>
              <p className="text-xs text-amber-700 font-medium">
                Keep this private — it grants full owner access.
              </p>
            </div>
          </div>
        </div>

        {/* Footer — Delete Map */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
            >
              🗑 Delete Map
            </button>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <span className="text-sm text-slate-600 flex-1">
                Are you sure? This cannot be undone.
              </span>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          )}

          {!showDeleteConfirm && (
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LinkRow sub-component
// ---------------------------------------------------------------------------

interface LinkRowProps {
  label: string;
  description: string;
  url: string;
  linkKey: string;
  copiedKey: string | null;
  onCopy: (key: string, url: string) => void;
  variant?: 'default' | 'warning';
}

function LinkRow({
  label,
  description,
  url,
  linkKey,
  copiedKey,
  onCopy,
  variant = 'default',
}: LinkRowProps) {
  const isCopied = copiedKey === linkKey;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
        <button
          onClick={() => onCopy(linkKey, url)}
          className={[
            'ml-3 shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-150',
            isCopied
              ? 'bg-green-50 border-green-200 text-green-600'
              : variant === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
          ].join(' ')}
        >
          {isCopied ? '✓ Copied!' : '📋 Copy'}
        </button>
      </div>
      {/* URL preview */}
      <div className="flex items-center px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden">
        <span className="text-xs text-slate-500 truncate font-mono">{url}</span>
      </div>
    </div>
  );
}
