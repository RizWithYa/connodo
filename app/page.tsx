'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, createTokenClient } from '@/lib/supabase';

interface OwnedMap {
  id: string;
  ownerToken: string;
  title: string;
  updatedAt: string;
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

  // ── Load owned maps from localStorage + Supabase ──────────────────────
  const loadMaps = useCallback(async () => {
    setLoading(true);
    try {
      const entries: { id: string; ownerToken: string }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mindmap_owned_')) {
          const id = key.replace('mindmap_owned_', '');
          const ownerToken = localStorage.getItem(key);
          if (ownerToken) {
            entries.push({ id, ownerToken });
          }
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
            .select('title, updated_at')
            .eq('id', id)
            .single();

          if (!error && data) {
            results.push({
              id,
              ownerToken,
              title: data.title,
              updatedAt: data.updated_at,
            });
          } else {
            // Row deleted from Supabase — clean up the orphaned localStorage key
            localStorage.removeItem(`mindmap_owned_${id}`);
          }
        })
      );

      // Most recently updated first
      results.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setMaps(results);
    } catch (e) {
      console.error('Failed to load maps:', e);
    } finally {
      setLoading(false);
    }
  }, []);

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
        });

      if (error) {
        console.error('Create failed:', error);
        setCreateError('Could not create map. Please try again.');
        return;
      }

      localStorage.setItem(`mindmap_owned_${newId}`, newOwnerToken);
      router.push(`/map/${newId}?owner=${newOwnerToken}`);
    } catch (e) {
      console.error('Create exception:', e);
      setCreateError('Unexpected error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  // ── Delete a map from Supabase + localStorage ─────────────────────────
  async function handleDelete(id: string, ownerToken: string) {
    setDeletingId(id);
    try {
      const client = createTokenClient(ownerToken);
      const { error } = await client
        .from('mindmaps')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete failed:', error);
        return;
      }

      localStorage.removeItem(`mindmap_owned_${id}`);
      setMaps((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.error('Delete exception:', e);
    } finally {
      setDeletingId(null);
    }
  }

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
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          MindMap
        </h1>
        <p className="text-slate-500 text-center max-w-md">
          A frictionless mind-mapping tool. No account required.
        </p>
      </div>

      {/* Create button — always at top */}
      <div className="flex justify-center mb-8">
        <button
          onClick={handleCreate}
          disabled={creating}
          className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 active:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {creating ? 'Creating…' : '+ Create New Map'}
        </button>
      </div>

      {createError && (
        <p className="text-red-500 text-sm text-center mb-6">{createError}</p>
      )}

      {/* Map list / empty state / loading */}
      {loading ? (
        <div className="flex justify-center py-12">
          <p className="text-slate-400 text-sm">Loading your maps…</p>
        </div>
      ) : maps.length === 0 ? (
        <div className="flex justify-center py-12">
          <p className="text-slate-400 text-sm">
            No maps yet. Create your first one!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {maps.map((map) => (
            <div
              key={map.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-slate-900 truncate mb-1">
                {map.title}
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Updated {formatDate(map.updatedAt)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    router.push(`/map/${map.id}?owner=${map.ownerToken}`)
                  }
                  className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 transition-colors"
                >
                  Open
                </button>
                <button
                  onClick={() => handleDelete(map.id, map.ownerToken)}
                  disabled={deletingId === map.id}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {deletingId === map.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
