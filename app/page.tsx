'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase, createTokenClient, onAuthStateChange } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

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
        className="w-full bg-[#1a2150] text-[#EAE0CF] font-semibold text-lg border border-[#4B5694] rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-[#7288AE] mb-1"
      />
    );
  }

  return (
    <h3
      onClick={() => setEditing(true)}
      className="font-semibold text-[#EAE0CF] truncate mb-1 text-lg cursor-text hover:text-white transition-colors"
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
  const [migrated, setMigrated] = useState(false);
  const isLoggedIn = !!session;

  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((newSession) => {
      setSession(newSession);
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  // Migration: localStorage maps to Supabase user_id
  useEffect(() => {
    if (!isLoggedIn || migrated) return;

    async function migrateLocalMaps() {
      const userId = session!.user.id;
      const keysToMigrate: { id: string; ownerToken: string }[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mindmap_owned_')) {
          const id = key.replace('mindmap_owned_', '');
          const ownerToken = localStorage.getItem(key);
          if (ownerToken) keysToMigrate.push({ id, ownerToken });
        }
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
    }

    migrateLocalMaps();
  }, [isLoggedIn, migrated, session]);

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

  useEffect(() => {
    loadMaps();
  }, [loadMaps]);

  // ── Create a new map ──────────────────────────────────────────────────
  async function handleCreate() {
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
          title: 'Untitled Map',
          owner_token: newOwnerToken,
          edit_token: newEditToken,
          view_token: newViewToken,
          user_id: session?.user?.id ?? null,
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
    <main className="min-h-screen bg-[#1a2150]">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#111844] py-24 sm:py-32 px-6 flex flex-col items-center justify-center">
        {/* Subtle animated blobs background */}
        <div className="absolute top-0 left-1/2 w-full max-w-5xl -translate-x-1/2 h-full overflow-hidden pointer-events-none opacity-40">
          <div className="absolute top-10 left-10 w-64 h-64 bg-[#4B5694] rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-blob" />
          <div className="absolute top-0 right-20 w-72 h-72 bg-[#7288AE] rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-10 left-1/3 w-80 h-80 bg-[#1a2150] rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
        </div>

        <div className="relative z-10 text-center max-w-2xl mx-auto flex flex-col items-center gap-6">
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-[#EAE0CF]">
            MindMap
          </h1>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Think freely. Share instantly.
          </h2>
          <p className="text-lg sm:text-xl text-[#7288AE] max-w-xl mx-auto">
            Create beautiful mindmaps and share them with anyone — no account required.
          </p>

          <div className="mt-4">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-xl bg-[#4B5694] px-8 py-4 text-base font-semibold text-white hover:bg-opacity-80 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
            >
              {creating ? 'Creating…' : '+ Create New Map'}
            </button>
          </div>
          {createError && (
            <p className="text-red-400 text-sm text-center mt-2">{createError}</p>
          )}
        </div>
      </section>

      {/* Map List Section */}
      <section className="max-w-5xl mx-auto p-8">
        <h2 className="text-2xl font-bold text-[#EAE0CF] mb-6">Your Maps</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <p className="text-[#7288AE] text-sm animate-pulse">Loading your maps…</p>
          </div>
        ) : maps.length === 0 ? (
          <div className="flex justify-center py-12">
            <p className="text-[#7288AE] text-sm">
              No maps yet. Create your first one!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {maps.map((map) => (
              <div
                key={map.id}
                className="flex flex-col rounded-xl bg-[#111844] border border-[#4B5694]/30 shadow-lg hover:shadow-xl transition-all hover:border-[#4B5694] overflow-hidden"
              >
                {map.thumbnail ? (
                  <img
                    src={map.thumbnail}
                    alt=""
                    className="w-full h-[120px] object-cover"
                  />
                ) : (
                  <div className="w-full h-[120px] bg-[#111844] border-b border-[#4B5694]/30 flex items-center justify-center shrink-0">
                    <span className="text-[#4B5694] text-xs font-medium opacity-50">No Preview</span>
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
                  <p className="text-xs text-[#7288AE] mb-5">
                    Updated {formatDate(map.updatedAt)}
                  </p>
                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() =>
                        router.push(`/map/${map.id}?owner=${map.ownerToken}`)
                      }
                      className="flex-1 rounded-lg bg-[#4B5694] px-3 py-2 text-xs font-medium text-white hover:bg-opacity-80 transition-colors shadow-sm flex items-center justify-center gap-1"
                    >
                      Open &rarr;
                    </button>
                    <button
                      onClick={() =>
                        window.open(`/map/${map.id}?view=${map.viewToken}`, '_blank')
                      }
                      className="rounded-lg bg-[#1a2150] border border-[#4B5694]/50 px-3 py-2 text-xs font-medium text-[#EAE0CF] hover:bg-[#4B5694]/30 transition-colors shadow-sm flex items-center justify-center gap-1"
                      title="Preview as Viewer"
                    >
                      Preview 🔍
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
