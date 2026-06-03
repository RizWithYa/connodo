'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Comment, fetchComments, addComment, deleteComment } from '@/lib/commentsService';

interface CommentPanelProps {
  nodeId: string;
  mapId: string;
  token: string;
  role: string;
  onClose: () => void;
  authorName: string;
}

export default function CommentPanel({
  nodeId,
  mapId,
  token,
  role,
  onClose,
  authorName,
}: CommentPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeAuthor = authorName || 'Anonymous';
  const isViewer = role === 'viewer';

  const loadComments = useCallback(async () => {
    if (!nodeId || !mapId) return;
    setLoading(true);
    try {
      const data = await fetchComments(token || '', mapId, nodeId);
      setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [token, mapId, nodeId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || submitting) return;

    setSubmitting(true);
    try {
      await addComment(token || '', mapId, nodeId, text.trim(), activeAuthor);
      setText('');
      await loadComments();
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (confirm('Are you sure you want to delete this comment?')) {
      try {
        await deleteComment(token || '', commentId);
        await loadComments();
      } catch (error) {
        console.error('Error deleting comment:', error);
      }
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed right-0 top-14 bottom-0 w-[320px] bg-mindmap-bg-primary text-mindmap-text-primary border-l border-mindmap-text-primary/10 flex flex-col z-40 shadow-2xl font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-mindmap-text-primary/10">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold tracking-wide text-mindmap-text-primary">Comments</h2>
          <span className="text-xs text-mindmap-text-primary/50 truncate max-w-[200px]" title={nodeId}>
            Node: {nodeId}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-full text-mindmap-text-primary/60 hover:text-mindmap-text-primary hover:bg-mindmap-text-primary/10 transition-all duration-200"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Comment List */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 scrollbar-thin scrollbar-thumb-[#EAE0CF]/10 scrollbar-track-transparent">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10">
            <span className="w-5 h-5 border-2 border-mindmap-text-primary border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-mindmap-text-primary/40 animate-pulse">Loading comments...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
            <span className="text-2xl mb-2 opacity-40">💬</span>
            <p className="text-sm font-medium text-mindmap-text-primary/50">No comments yet</p>
            <p className="text-xs text-mindmap-text-primary/30 mt-1">Be the first to share your thoughts!</p>
          </div>
        ) : (
          comments.map((comment) => {
            // Delete button: only for owner/editor who wrote it
            const canDelete =
              (role === 'owner' || role === 'editor') &&
              comment.author === activeAuthor;

            return (
              <div
                key={comment.id}
                className="group relative flex flex-col gap-1 p-3 bg-mindmap-text-primary/5 hover:bg-mindmap-text-primary/10 rounded-xl transition-all duration-200 border border-mindmap-text-primary/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-mindmap-text-primary">
                    {comment.author}
                  </span>
                  <span className="text-[10px] text-mindmap-text-primary/40">
                    {formatTime(comment.created_at)}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-mindmap-text-primary/85 whitespace-pre-wrap mt-0.5 break-words">
                  {comment.text}
                </p>

                {canDelete && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-mindmap-text-primary/40 hover:text-red-400 transition-all duration-200"
                    title="Delete comment"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Input Form at Bottom */}
      {!isViewer && (
        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-mindmap-text-primary/10 bg-mindmap-bg-primary/80 flex flex-col gap-2"
        >
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Comment as ${activeAuthor}...`}
              rows={2}
              className="w-full text-xs bg-mindmap-text-primary/5 text-mindmap-text-primary placeholder-mindmap-text-primary/40 rounded-xl px-3 py-2.5 outline-none border border-mindmap-text-primary/10 focus:border-mindmap-text-primary/30 transition-all duration-200 resize-none"
              required
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-mindmap-text-primary/30 truncate max-w-[150px]">
              Author: <span className="font-semibold">{activeAuthor}</span>
            </span>
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-mindmap-accent hover:bg-mindmap-accent/80 disabled:bg-mindmap-accent/40 disabled:text-mindmap-text-primary/40 text-white transition-all duration-200"
            >
              {submitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
