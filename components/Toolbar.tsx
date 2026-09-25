'use client';

import { useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  Undo2,
  Redo2,
  Share2,
  Check,
  AlertCircle,
  Loader2,
  MessageSquare,
  Maximize2,
  ChevronDown,
  Image,
  FileText,
  FileCode,
} from 'lucide-react';

interface ToolbarProps {
  canEdit?: boolean;
  isOwner?: boolean;
  onAddNode?: () => void;
  onDeleteSelected?: () => void;
  onShare?: () => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onExportPng?: () => void;
  onExportPdf?: () => void;
  onExportJson?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isPresentationMode?: boolean;
  onTogglePresentation?: () => void;
  commentsEnabled?: boolean;
  commentMode?: boolean;
  onToggleCommentMode?: () => void;
}

export default function Toolbar({
  canEdit = false,
  isOwner = false,
  onAddNode,
  onDeleteSelected,
  onShare,
  saveStatus = 'idle',
  onExportPng,
  onExportPdf,
  onExportJson,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  isPresentationMode = false,
  onTogglePresentation,
  commentsEnabled = true,
  commentMode = false,
  onToggleCommentMode,
}: ToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  function handleExportOption(fn?: () => void) {
    setExportOpen(false);
    fn?.();
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b bg-white shrink-0 h-12">
      {canEdit && (
        <>
          <button
            onClick={onAddNode}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            <Plus className="w-4 h-4 text-slate-700" />
            Add Node
          </button>

          <button
            onClick={onDeleteSelected}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-600 active:bg-red-100 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>

          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
            Undo
          </button>

          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
            Redo
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1" />
        </>
      )}

      {/* Share — owner only */}
      {isOwner && (
        <button
          onClick={onShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 active:bg-blue-100 transition-colors"
        >
          <Share2 className="w-4 h-4 text-blue-600" />
          Share
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save status */}
      {saveStatus !== 'idle' && (
        <span
          className={[
            'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md',
            saveStatus === 'saving' ? 'text-slate-500 bg-slate-50' : '',
            saveStatus === 'saved' ? 'text-green-600 bg-green-50' : '',
            saveStatus === 'error' ? 'text-red-600 bg-red-50' : '',
          ].join(' ')}
        >
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
              <span>Saving…</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span>Saved</span>
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              <span>Save failed</span>
            </>
          )}
        </span>
      )}

      {/* Comment Mode Toggle */}
      {commentsEnabled && (
        <button
          onClick={onToggleCommentMode}
          className={[
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors',
            commentMode
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700',
          ].join(' ')}
          title={commentMode ? 'Exit comment mode' : 'Comment mode'}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Comments</span>
          {commentMode && <Check className="w-3 h-3 text-blue-600" />}
        </button>
      )}

      {/* Presentation Mode Toggle */}
      <button
        onClick={onTogglePresentation}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors"
        title="Presentation Mode (Ctrl+Shift+P)"
      >
        <Maximize2 className="w-4 h-4 text-slate-600" />
        Present
      </button>

      {/* Export dropdown — available to all roles */}
      <div className="relative" ref={exportRef}>
        <button
          onClick={() => setExportOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors"
          aria-haspopup="true"
          aria-expanded={exportOpen}
        >
          <span>Export</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {exportOpen && (
          <>
            {/* Click-outside overlay */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setExportOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              <button
                onClick={() => handleExportOption(onExportPng)}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <Image className="w-4 h-4 text-slate-500" />
                <span>PNG</span>
              </button>
              <button
                onClick={() => handleExportOption(onExportPdf)}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>PDF</span>
              </button>
              <button
                onClick={() => handleExportOption(onExportJson)}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <FileCode className="w-4 h-4 text-slate-500" />
                <span>JSON</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
