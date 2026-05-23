'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/**
 * Homepage — Create New Map button.
 *
 * Per spec:
 *   1. INSERT a new mindmaps row (Supabase generates id + all 3 tokens via DEFAULT)
 *   2. Store owner_token in localStorage under `mindmap_owned_[id]`
 *   3. Redirect to /map/[id]?owner=[owner_token]
 */
export default function HomePage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);

    try {
      // 1. Generate the UUIDs on the client so we don't need a SELECT return.
      // This avoids the RLS 401 Unauthorized issue caused by the SELECT policy
      // trying to read the row without the token header during the INSERT...RETURNING phase.
      const newId = crypto.randomUUID();
      const newOwnerToken = crypto.randomUUID();
      const newEditToken = crypto.randomUUID();
      const newViewToken = crypto.randomUUID();

      // 2. Use the default client for the insert. Do NOT chain .select()
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

      // Persist so the owner can return without keeping the URL
      if (typeof window !== 'undefined') {
        localStorage.setItem(`mindmap_owned_${newId}`, newOwnerToken);
      }

      router.push(`/map/${newId}?owner=${newOwnerToken}`);
    } catch (e) {
      console.error('Create exception:', e);
      setCreateError('Unexpected error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">MindMap</h1>
      <p className="text-slate-500 text-center max-w-md">
        A frictionless mind-mapping tool. No account required.
      </p>

      <button
        onClick={handleCreate}
        disabled={creating}
        className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 active:bg-slate-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {creating ? 'Creating…' : 'Create New Map'}
      </button>

      {createError && (
        <p className="text-red-500 text-sm">{createError}</p>
      )}
    </main>
  );
}
