'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase, createTokenClient, onAuthStateChange } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { TEMPLATES } from '@/lib/templates';
import type { TemplateData } from '@/lib/templates';
import TemplateDropdown from '@/components/TemplateDropdown';
interface OwnedMap {
  id: string;
  ownerToken: string;
  title: string;
  updatedAt: string;
  viewToken: string;
  thumbnail?: string;
}

// ── Inline Title Component ────────────────────────────────────────────────
function InlineRenameTitle({
  mapId,
  ownerToken,
  initialTitle,
  onRenameOptimistic,
  session,
}: {
  mapId: string;
  ownerToken: string;
  initialTitle: string;
  onRenameOptimistic: (id: string, newTitle: string) => void;
  session: Session | null;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  async function save() {
    setEditing(false);
    const newTitle = title.trim() || 'Untitled Map';
    setTitle(newTitle);
    if (newTitle === initialTitle) return;

    // Optimistic update
    onRenameOptimistic(mapId, newTitle);

    try {
      if (session) {
        // Authenticated: use supabase directly (RLS uses auth.uid())
        const { error } = await supabase
          .from('mindmaps')
          .update({ title: newTitle, updated_at: new Date().toISOString() })
          .eq('id', mapId);
        if (error) throw error;
      } else {
        // Anon: use token client
        const client = createTokenClient(ownerToken);
        const { error } = await client
          .from('mindmaps')
          .update({ title: newTitle, updated_at: new Date().toISOString() })
          .eq('id', mapId)
          .eq('owner_token', ownerToken);
        if (error) throw error;
      }
    } catch (err) {
      console.error('Failed to rename map:', err);
      // Revert on error
      setTitle(initialTitle);
      onRenameOptimistic(mapId, initialTitle);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setTitle(initialTitle);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        className="w-full bg-mindmap-bg-secondary text-mindmap-text-primary font-semibold text-lg border border-mindmap-accent rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-mindmap-text-muted mb-1"
      />
    );
  }

  return (
    <h3
      onClick={() => setEditing(true)}
      className="font-semibold text-mindmap-text-primary truncate mb-1 text-lg cursor-text hover:text-white transition-colors"
      title="Click to rename"
    >
      {title}
    </h3>
  );
}

/**
 * Homepage — "Create New Map" button + card grid of previously created maps.
 *
 * Reads localStorage keys matching `mindmap_owned_[id]`, fetches metadata
 * from Supabase via createTokenClient(owner_token), and renders a card grid.
 */
export default function HomePage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [maps, setMaps] = useState<OwnedMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const isLoggedIn = !!session;
  const [migrated, setMigrated] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const templateBtnRef = useRef<HTMLButtonElement>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Load owned maps from localStorage + Supabase
  const loadMaps = useCallback(async () => {
    setLoading(true);
    try {
      if (session) {
        // AUTHENTICATED: fetch by user_id
        const { data, error } = await supabase
          .from('mindmaps')
          .select('id, title, updated_at, view_token, owner_token')
          .eq('user_id', session.user.id)
          .order('updated_at', { ascending: false });

        if (!error && data) {
          const results: OwnedMap[] = data.map((row) => ({
            id: row.id,
            ownerToken: row.owner_token,
            title: row.title,
            updatedAt: row.updated_at,
            viewToken: row.view_token,
            thumbnail: localStorage.getItem('mindmap_thumb_' + row.id) || undefined,
          }));
          setMaps(results);
        } else {
          console.error('Failed to load authenticated maps:', error);
          setMaps([]);
        }
      } else {
        // ANON: localStorage-based
        const entries: { id: string; ownerToken: string }[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('mindmap_owned_')) {
            const id = key.replace('mindmap_owned_', '');
            const ownerToken = localStorage.getItem(key);
            if (ownerToken) entries.push({ id, ownerToken });
          }
        }

        if (entries.length === 0) {
          setMaps([]);
          setLoading(false);
          return;
        }

        const results: OwnedMap[] = [];
        await Promise.all(
          entries.map(async ({ id, ownerToken }) => {
            const client = createTokenClient(ownerToken);
            const { data, error } = await client
              .from('mindmaps')
              .select('title, updated_at, view_token')
              .eq('id', id)
              .single();

            if (!error && data) {
              const thumbnail = localStorage.getItem('mindmap_thumb_' + id) || undefined;
              results.push({ id, ownerToken, title: data.title, updatedAt: data.updated_at, viewToken: data.view_token, thumbnail });
            } else {
              localStorage.removeItem('mindmap_owned_' + id);
            }
          })
        );

        results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setMaps(results);
      }
    } catch (e) {
      console.error('Failed to load maps:', e);
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Close templates dropdown on click outside
  useEffect(() => {
    if (!showTemplates) return;
    function handleGlobalClick() {
      setShowTemplates(false);
    }
    const timer = setTimeout(() => {
      window.addEventListener('click', handleGlobalClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleGlobalClick);
    };
  }, [showTemplates]);
  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((newSession) => {
      setSession(newSession);
      if (!newSession) {
        setMigrated(false);
      }
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  // 1. One-time migration of "connodo" keys back to "mindmap" keys in localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const keysToMigrate: { key: string; newKey: string; value: string }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          if (key.startsWith('connodo_owned_')) {
            const newKey = 'mindmap_owned_' + key.substring('connodo_owned_'.length);
            const val = localStorage.getItem(key);
            if (val) keysToMigrate.push({ key, newKey, value: val });
          } else if (key.startsWith('connodo_thumb_')) {
            const newKey = 'mindmap_thumb_' + key.substring('connodo_thumb_'.length);
            const val = localStorage.getItem(key);
            if (val) keysToMigrate.push({ key, newKey, value: val });
          }
        }
      }
      for (const { key, newKey, value } of keysToMigrate) {
        localStorage.setItem(newKey, value);
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.error('Failed to migrate Connodo localStorage keys to MindMap:', e);
    }
  }, []);

  // 2. Migration of anonymous local maps to Supabase user account on login
  useEffect(() => {
    const userId = session?.user?.id;
    if (!isLoggedIn || migrated || !userId) return;

    async function migrateLocalMaps() {
      const keysToMigrate: { id: string; ownerToken: string }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mindmap_owned_')) {
          const id = key.replace('mindmap_owned_', '');
          const ownerToken = localStorage.getItem(key);
          if (ownerToken) keysToMigrate.push({ id, ownerToken });
        }
      }

      if (keysToMigrate.length === 0) {
        setMigrated(true);
        return;
      }

      for (const { id, ownerToken } of keysToMigrate) {
        try {
          const client = createTokenClient(ownerToken);
          const { data, error } = await client
            .from('mindmaps')
            .select('user_id')
            .eq('id', id)
            .single();

          if (!error && data && data.user_id === null) {
            await supabase
              .from('mindmaps')
              .update({ user_id: userId })
              .eq('id', id)
              .eq('owner_token', ownerToken);
            localStorage.removeItem('mindmap_owned_' + id);
          } else if (error || !data) {
            localStorage.removeItem('mindmap_owned_' + id);
          }
        } catch (e) {
          console.error('Migration failed for map', id, e);
        }
      }

      setMigrated(true);
      loadMaps();
    }

    migrateLocalMaps();
  }, [isLoggedIn, migrated, session, loadMaps]);



  useEffect(() => {
    loadMaps();
  }, [loadMaps]);

  // ── Create a new map ──────────────────────────────────────────────────
  async function handleCreate(template?: TemplateData) {
    setCreating(true);
    setCreateError(null);

    try {
      const newId = crypto.randomUUID();
      const newOwnerToken = crypto.randomUUID();
      const newEditToken = crypto.randomUUID();
      const newViewToken = crypto.randomUUID();

      // Use the default client for INSERT — do NOT chain .select()
      const { error } = await supabase
        .from('mindmaps')
        .insert({
          id: newId,
          title: template ? template.label : 'Untitled Map',
          owner_token: newOwnerToken,
          edit_token: newEditToken,
          view_token: newViewToken,
          ...(template ? { nodes: template.nodes, edges: template.edges } : {}),
        });

      if (error) {
        console.error('Create failed:', error);
        setCreateError('Could not create map. Please try again.');
        return;
      }

      if (!session) {
        localStorage.setItem('mindmap_owned_' + newId, newOwnerToken);
      }
      router.push('/map/' + newId + '?owner=' + newOwnerToken);
    } catch (e) {
      console.error('Create exception:', e);
      setCreateError('Unexpected error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  // Delete a map from Supabase + localStorage
  async function handleDelete(id: string, ownerToken: string) {
    setDeletingId(id);
    try {
      if (session) {
        // Authenticated: use supabase directly (RLS checks auth.uid())
        const { error } = await supabase
          .from('mindmaps')
          .delete()
          .eq('id', id);
        if (error) { console.error('Delete failed:', error); return; }
      } else {
        // Anon: use token client
        const client = createTokenClient(ownerToken);
        const { error } = await client
          .from('mindmaps')
          .delete()
          .eq('id', id);
        if (error) { console.error('Delete failed:', error); return; }
        localStorage.removeItem('mindmap_owned_' + id);
      }
      setMaps((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.error('Delete exception:', e);
    } finally {
      setDeletingId(null);
    }
  }

  // Duplicate a map
  async function handleDuplicate(mapId: string, ownerToken: string) {
    setDuplicatingId(mapId);
    try {
      const client = session ? supabase : createTokenClient(ownerToken);
      const { data, error } = await client
        .from('mindmaps')
        .select('title, nodes, edges')
        .eq('id', mapId)
        .single();

      if (error || !data) {
        console.error('Failed to fetch map for duplication:', error);
        return;
      }

      const newId = crypto.randomUUID();
      const newOwnerToken = crypto.randomUUID();
      const newEditToken = crypto.randomUUID();
      const newViewToken = crypto.randomUUID();

      const insertData: Record<string, unknown> = {
        id: newId,
        title: data.title + ' (copy)',
        nodes: data.nodes,
        edges: data.edges,
        owner_token: newOwnerToken,
        edit_token: newEditToken,
        view_token: newViewToken,
      };

      if (session) {
        insertData.user_id = session.user.id;
      }

      const { error: insertError } = await supabase
        .from('mindmaps')
        .insert(insertData);

      if (insertError) {
        console.error('Duplicate failed:', insertError);
        return;
      }

      if (!session) {
        localStorage.setItem('mindmap_owned_' + newId, newOwnerToken);
      }

      loadMaps();
    } catch (e) {
      console.error('Duplicate exception:', e);
    } finally {
      setDuplicatingId(null);
    }
  }

  const handleRenameOptimistic = useCallback((id: string, newTitle: string) => {
    setMaps((prev) =>
      prev.map((m) => (m.id === id ? { ...m, title: newTitle } : m))
    );
  }, []);

  // ── Format ISO date for display ───────────────────────────────────────
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar />
    <main className="min-h-screen bg-mindmap-bg-secondary pt-14">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-mindmap-bg-primary py-24 sm:py-32 px-6 flex flex-col items-center justify-center">
        {/* Subtle animated blobs background */}
        <div className="absolute top-0 left-1/2 w-full max-w-5xl -translate-x-1/2 h-full overflow-hidden pointer-events-none opacity-40">
          <div className="absolute top-10 left-10 w-64 h-64 bg-mindmap-accent rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-blob" />
          <div className="absolute top-0 right-20 w-72 h-72 bg-mindmap-text-muted rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-10 left-1/3 w-80 h-80 bg-mindmap-bg-secondary rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
        </div>

        <div className="relative z-10 text-center max-w-2xl mx-auto flex flex-col items-center gap-6">
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-mindmap-text-primary">
            MindMap
          </h1>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Think freely. Share instantly.
          </h2>
          <p className="text-lg sm:text-xl text-mindmap-text-muted max-w-xl mx-auto">
            Create beautiful mindmaps and share them with anyone — no account required.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => handleCreate()}
              disabled={creating}
              className="rounded-xl bg-mindmap-accent px-8 py-4 text-base font-semibold text-white hover:bg-mindmap-accent/80 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
            >
              {creating ? 'Creating…' : '+ Create New Map'}
            </button>

            <div>
              <button
                ref={templateBtnRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTemplates(!showTemplates);
                }}
                disabled={creating}
                className="rounded-xl bg-mindmap-accent px-6 py-3 text-sm font-semibold text-white hover:bg-mindmap-accent/80 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transform hover:-translate-y-0.5 flex items-center gap-1.5"
              >
                New from Template {showTemplates ? '▲' : '▼'}
              </button>
              {showTemplates && (
                <TemplateDropdown
                  triggerEl={templateBtnRef.current}
                  onSelectTemplate={(tmpl) => {
                    setShowTemplates(false);
                    handleCreate(tmpl);
                  }}
                  onClose={() => setShowTemplates(false)}
                />
              )}
            </div>
          {createError && (
            <p className="text-red-400 text-sm text-center mt-2">{createError}</p>
          )}
        </div>
        </div>
      </section>

      {/* Map List Section */}
      <section className="max-w-5xl mx-auto p-8">
        <h2 className="text-2xl font-bold text-mindmap-text-primary mb-6">Your Maps</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <p className="text-mindmap-text-muted text-sm animate-pulse">Loading your maps…</p>
          </div>
        ) : maps.length === 0 ? (
          <div className="flex justify-center py-12">
            <p className="text-mindmap-text-muted text-sm">
              No maps yet. Create your first one!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {maps.map((map) => (
              <div
                className="flex flex-col rounded-xl bg-mindmap-bg-primary border border-mindmap-border/30 shadow-lg hover:shadow-xl transition-all hover:border-mindmap-accent overflow-hidden"
              >
                {map.thumbnail ? (
                  <img
                    src={map.thumbnail}
                    alt=""
                    className="w-full h-[120px] object-cover"
                  />
                ) : (
                  <div className="w-full h-[120px] bg-mindmap-bg-primary border-b border-mindmap-border/30 flex items-center justify-center shrink-0">
                    <span className="text-mindmap-accent text-xs font-medium opacity-50">No Preview</span>
                  </div>
                )}

                <div className="p-5 flex flex-col flex-1">
                  <InlineRenameTitle
                    mapId={map.id}
                    ownerToken={map.ownerToken}
                    initialTitle={map.title}
                    onRenameOptimistic={handleRenameOptimistic}
                    session={session}
                  />
                  <p className="text-xs text-mindmap-text-muted mb-5">
                    Updated {formatDate(map.updatedAt)}
                  </p>
                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() =>
                        router.push(`/map/${map.id}?owner=${map.ownerToken}`)
                      }
                      className="flex-1 rounded-lg bg-mindmap-accent px-3 py-2 text-xs font-medium text-white hover:bg-mindmap-accent/80 transition-colors shadow-sm flex items-center justify-center gap-1"
                    >
                      Open &rarr;
                    </button>
                    <button
                      onClick={() =>
                        window.open(`/map/${map.id}?view=${map.viewToken}`, '_blank')
                      }
                      className="rounded-lg bg-mindmap-bg-secondary border border-mindmap-border/50 px-3 py-2 text-xs font-medium text-mindmap-text-primary hover:bg-mindmap-accent/30 transition-colors shadow-sm flex items-center justify-center gap-1"
                      title="Preview as Viewer"
                    >
                      Preview 🔍
                    </button>
                    <button
                      onClick={() => handleDuplicate(map.id, map.ownerToken)}
                      disabled={duplicatingId === map.id}
                      className="rounded-lg bg-mindmap-bg-secondary border border-mindmap-border/50 px-3 py-1.5 text-xs font-medium text-mindmap-text-primary hover:bg-mindmap-accent/30 transition-colors shadow-sm disabled:opacity-50"
                      title="Duplicate Map"
                    >
                      {duplicatingId === map.id ? '...' : '📋'}
                    </button>
                    <button
                      onClick={() => handleDelete(map.id, map.ownerToken)}
                      disabled={deletingId === map.id}
                      className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      title="Delete Map"
                    >
                      {deletingId === map.id ? '...' : '🗑'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
    </>
  );
}
