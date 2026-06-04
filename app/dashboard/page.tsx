'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase, createTokenClient, onAuthStateChange } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
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

  useEffect(() => { setTitle(initialTitle); }, [initialTitle]);

  async function save() {
    setEditing(false);
    const newTitle = title.trim() || 'Untitled Map';
    setTitle(newTitle);
    if (newTitle === initialTitle) return;
    onRenameOptimistic(mapId, newTitle);
    try {
      if (session) {
        const { error } = await supabase
          .from('mindmaps')
          .update({ title: newTitle, updated_at: new Date().toISOString() })
          .eq('id', mapId);
        if (error) throw error;
      } else {
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
      setTitle(initialTitle);
      onRenameOptimistic(mapId, initialTitle);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); setTitle(initialTitle); setEditing(false); }
  }

  if (editing) {
    return (
      <input
        autoFocus value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save} onKeyDown={handleKeyDown}
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

export default function DashboardPage() {
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
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((s) => {
      setSession(s);
      setAuthChecked(true);
      if (!s) router.replace('/');
    });
    return () => { subscription.unsubscribe(); };
  }, [router]);

  const loadMaps = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
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
        setMaps([]);
      }
    } catch (e) {
      console.error('Failed to load maps:', e);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { if (showTemplates) {
    const t = setTimeout(() => { window.addEventListener('click', () => setShowTemplates(false)); }, 0);
    return () => { clearTimeout(t); };
  }}, [showTemplates]);

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
      if (keysToMigrate.length === 0) { setMigrated(true); return; }

      for (const { id, ownerToken } of keysToMigrate) {
        try {
          const client = createTokenClient(ownerToken);
          const { data, error } = await client.from('mindmaps').select('user_id').eq('id', id).single();
          if (!error && data && data.user_id === null) {
            await supabase.from('mindmaps').update({ user_id: userId }).eq('id', id).eq('owner_token', ownerToken);
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

  useEffect(() => { loadMaps(); }, [loadMaps]);

  async function handleCreate(template?: TemplateData) {
    setCreating(true);
    setCreateError(null);
    try {
      if (!session) {
        setCreateError('Please login or register to save mindmaps. Use Guest Mode for temporary drafts.');
        return;
      }

      const newId = crypto.randomUUID();
      const newOwnerToken = crypto.randomUUID();
      const newEditToken = crypto.randomUUID();
      const newViewToken = crypto.randomUUID();

      const insertData: Record<string, unknown> = {
        id: newId,
        title: template ? template.label : 'Untitled Map',
        owner_token: newOwnerToken,
        edit_token: newEditToken,
        view_token: newViewToken,
        ...(template ? { nodes: template.nodes, edges: template.edges } : {}),
      };
      insertData.user_id = session.user.id;

      const { error } = await supabase.from('mindmaps').insert(insertData);
      if (error) {
        console.error('Create failed:', error);
        setCreateError('Could not create map. Please try again.');
        return;
      }
      router.push('/map/' + newId + '?owner=' + newOwnerToken);
    } catch (e) {
      console.error('Create exception:', e);
      setCreateError('Unexpected error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, ownerToken: string) {
    setDeletingId(id);
    try {
      if (session) {
        const { error } = await supabase.from('mindmaps').delete().eq('id', id);
        if (error) { console.error('Delete failed:', error); return; }
      } else {
        const client = createTokenClient(ownerToken);
        const { error } = await client.from('mindmaps').delete().eq('id', id);
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

  async function handleDuplicate(mapId: string, ownerToken: string) {
    setDuplicatingId(mapId);
    try {
      const client = session ? supabase : createTokenClient(ownerToken);
      const { data, error } = await client.from('mindmaps').select('title, nodes, edges').eq('id', mapId).single();
      if (error || !data) { console.error('Failed to fetch map for duplication:', error); return; }

      const newId = crypto.randomUUID();
      const newOwnerToken = crypto.randomUUID();
      const newEditToken = crypto.randomUUID();
      const newViewToken = crypto.randomUUID();
      const insertData: Record<string, unknown> = {
        id: newId, title: data.title + ' (copy)', nodes: data.nodes, edges: data.edges,
        owner_token: newOwnerToken, edit_token: newEditToken, view_token: newViewToken,
      };
      if (session) insertData.user_id = session.user.id;

      const { error: insertError } = await supabase.from('mindmaps').insert(insertData);
      if (insertError) { console.error('Duplicate failed:', insertError); return; }
      if (!session) localStorage.setItem('mindmap_owned_' + newId, newOwnerToken);
      loadMaps();
    } catch (e) {
      console.error('Duplicate exception:', e);
    } finally {
      setDuplicatingId(null);
    }
  }

  const handleRenameOptimistic = useCallback((id: string, newTitle: string) => {
    setMaps((prev) => prev.map((m) => (m.id === id ? { ...m, title: newTitle } : m)));
  }, []);

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  if (!authChecked) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-mindmap-bg-secondary pt-14 flex items-center justify-center">
          <p className="text-mindmap-text-muted animate-pulse">Loading…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-mindmap-bg-secondary pt-14">
        <section className="bg-mindmap-bg-primary border-b border-mindmap-border/30 px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold text-mindmap-text-primary">Dashboard</h1>
            <p className="text-mindmap-text-muted mt-1">
              Manage your saved mindmaps. Create a new one or continue where you left off.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleCreate()}
                disabled={creating}
                className="rounded-xl bg-mindmap-accent px-6 py-3 text-sm font-semibold text-white hover:bg-mindmap-accent/80 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
              >
                {creating ? 'Creating…' : '+ Create New Mindmap'}
              </button>
              <div className="relative">
                <button
                  ref={templateBtnRef}
                  onClick={(e) => { e.stopPropagation(); setShowTemplates(!showTemplates); }}
                  disabled={creating}
                  className="rounded-xl bg-mindmap-accent px-5 py-3 text-sm font-semibold text-white hover:bg-mindmap-accent/80 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transform hover:-translate-y-0.5 flex items-center gap-1.5"
                >
                  From Template {showTemplates ? '▲' : '▼'}
                </button>
                {showTemplates && (
                  <TemplateDropdown
                    triggerEl={templateBtnRef.current}
                    onSelectTemplate={(tmpl) => { setShowTemplates(false); handleCreate(tmpl); }}
                    onClose={() => setShowTemplates(false)}
                  />
                )}
              </div>
            </div>
            {createError && <p className="text-red-400 text-sm mt-2">{createError}</p>}
          </div>
        </section>

        <section className="max-w-5xl mx-auto p-8">
          <h2 className="text-xl font-bold text-mindmap-text-primary mb-6">My Maps</h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <p className="text-mindmap-text-muted text-sm animate-pulse">Loading your maps…</p>
            </div>
          ) : maps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="text-5xl opacity-30">🗺️</div>
              <p className="text-mindmap-text-muted text-sm">No maps yet. Create your first one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {maps.map((map) => (
                <div
                  key={map.id}
                  className="flex flex-col rounded-xl bg-mindmap-bg-primary border border-mindmap-border/30 shadow-lg hover:shadow-xl transition-all hover:border-mindmap-accent overflow-hidden"
                >
                  {map.thumbnail ? (
                    <img src={map.thumbnail} alt="" className="w-full h-[120px] object-cover" />
                  ) : (
                    <div className="w-full h-[120px] bg-mindmap-bg-primary border-b border-mindmap-border/30 flex items-center justify-center shrink-0">
                      <span className="text-mindmap-accent text-xs font-medium opacity-50">No Preview</span>
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <InlineRenameTitle
                      mapId={map.id} ownerToken={map.ownerToken} initialTitle={map.title}
                      onRenameOptimistic={handleRenameOptimistic} session={session}
                    />
                    <p className="text-xs text-mindmap-text-muted mb-5">
                      Updated {formatDate(map.updatedAt)}
                    </p>
                    <div className="flex gap-2 mt-auto">
                      <button
                        onClick={() => router.push(`/map/${map.id}?owner=${map.ownerToken}`)}
                        className="flex-1 rounded-lg bg-mindmap-accent px-3 py-2 text-xs font-medium text-white hover:bg-mindmap-accent/80 transition-colors shadow-sm"
                      >
                        Open &rarr;
                      </button>
                      <button
                        onClick={() => window.open(`/map/${map.id}?view=${map.viewToken}`, '_blank')}
                        className="rounded-lg bg-mindmap-bg-secondary border border-mindmap-border/50 px-3 py-2 text-xs font-medium text-mindmap-text-primary hover:bg-mindmap-accent/30 transition-colors shadow-sm"
                        title="Preview as viewer"
                      >
                        👁
                      </button>
                      <button
                        onClick={() => handleDuplicate(map.id, map.ownerToken)}
                        disabled={duplicatingId === map.id}
                        className="rounded-lg bg-mindmap-bg-secondary border border-mindmap-border/50 px-3 py-1.5 text-xs font-medium text-mindmap-text-primary hover:bg-mindmap-accent/30 transition-colors shadow-sm disabled:opacity-50"
                        title="Duplicate map"
                      >
                        {duplicatingId === map.id ? '…' : '📋'}
                      </button>
                      <button
                        onClick={() => handleDelete(map.id, map.ownerToken)}
                        disabled={deletingId === map.id}
                        className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Delete map"
                      >
                        {deletingId === map.id ? '…' : '🗑'}
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
