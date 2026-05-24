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
                className="rounded-xl bg-[#111844] border border-[#4B5694]/30 p-5 shadow-lg hover:shadow-xl transition-all hover:border-[#4B5694]"
              >
                <h3 className="font-semibold text-[#EAE0CF] truncate mb-1 text-lg">
                  {map.title}
                </h3>
                <p className="text-xs text-[#7288AE] mb-5">
                  Updated {formatDate(map.updatedAt)}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      router.push(`/map/${map.id}?owner=${map.ownerToken}`)
                    }
                    className="flex-1 rounded-lg bg-[#4B5694] px-3 py-2 text-xs font-medium text-white hover:bg-opacity-80 transition-colors shadow-sm"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleDelete(map.id, map.ownerToken)}
                    disabled={deletingId === map.id}
                    className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    {deletingId === map.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
