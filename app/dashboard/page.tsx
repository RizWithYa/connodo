'use client';

import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import { createTokenClient, onAuthStateChange, supabase } from '@/lib/supabase';
import { TEMPLATES, type TemplateData } from '@/lib/templates';

type SortMode = 'recent' | 'az' | 'oldest';

type MindMapPreviewNode = {
  id: string;
  position: { x: number; y: number };
  data: { label?: unknown; color?: unknown; textColor?: unknown; bold?: unknown; italic?: unknown; underline?: unknown; shape?: unknown };
  width?: number;
  height?: number;
  measured?: { width?: number; height?: number };
};

type MindMapPreviewEdge = {
  id: string;
  source: string;
  target: string;
};

interface OwnedMap {
  id: string;
  ownerToken: string;
  title: string;
  updatedAt: string;
  viewToken: string;
  nodes: MindMapPreviewNode[];
  edges: MindMapPreviewEdge[];
  thumbnail?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parsePreviewNodes(value: unknown): MindMapPreviewNode[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((node) => {
    if (!isRecord(node) || typeof node.id !== 'string' || !isRecord(node.position)) return [];
    const { x, y } = node.position;
    if (typeof x !== 'number' || typeof y !== 'number') return [];

    const measured = isRecord(node.measured) ? node.measured : undefined;
    return [{
      id: node.id,
      position: { x, y },
      data: isRecord(node.data) ? node.data : {},
      width: typeof node.width === 'number' ? node.width : undefined,
      height: typeof node.height === 'number' ? node.height : undefined,
      measured: measured ? {
        width: typeof measured.width === 'number' ? measured.width : undefined,
        height: typeof measured.height === 'number' ? measured.height : undefined,
      } : undefined,
    }];
  });
}

function parsePreviewEdges(value: unknown): MindMapPreviewEdge[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((edge) => {
    if (!isRecord(edge) || typeof edge.id !== 'string' || typeof edge.source !== 'string' || typeof edge.target !== 'string') return [];
    return [{ id: edge.id, source: edge.source, target: edge.target }];
  });
}

function getPreviewBounds(nodes: Array<MindMapPreviewNode & { width: number; height: number }>) {
  const minX = Math.min(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const maxX = Math.max(...nodes.map((node) => node.position.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.position.y + node.height));
  const padding = 56;

  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(maxX - minX + padding * 2, 240),
    height: Math.max(maxY - minY + padding * 2, 120),
  };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTitle(initialTitle); }, [initialTitle]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

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
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save} onKeyDown={handleKeyDown}
        className="w-full bg-mindmap-bg-secondary text-mindmap-text-primary font-semibold text-lg border border-mindmap-accent rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-mindmap-text-muted mb-1"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full truncate bg-transparent p-0 text-left font-semibold text-mindmap-text-primary mb-1 text-lg cursor-text hover:text-white transition-colors"
      title="Click to rename"
    >
      {title}
    </button>
  );
}

function MindMapCardPreview({
  nodes,
  edges,
  title,
}: {
  nodes: MindMapPreviewNode[];
  edges: MindMapPreviewEdge[];
  title: string;
}) {
  if (nodes.length === 0) {
    return (
      <div className="w-full h-[132px] bg-mindmap-bg-secondary/60 border-b border-mindmap-border/30 flex items-center justify-center shrink-0">
        <div className="text-center">
          <div className="text-3xl opacity-30">🌿</div>
          <span className="mt-1 block text-mindmap-accent text-xs font-medium opacity-60">No Preview</span>
        </div>
      </div>
    );
  }

  const previewNodes = nodes.map((node) => {
    const width = node.measured?.width ?? node.width ?? 112;
    const height = node.measured?.height ?? node.height ?? 48;
    return { ...node, width, height };
  });
  const bounds = getPreviewBounds(previewNodes);
  const nodeById = new Map(previewNodes.map((node) => [node.id, node]));

  return (
    <div className="w-full h-[132px] bg-slate-50 border-b border-mindmap-border/30 overflow-hidden shrink-0">
      <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Preview of ${title}`} className="h-full w-full">
        <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="#f8fafc" />
        {edges.map((edge) => {
          const source = nodeById.get(edge.source);
          const target = nodeById.get(edge.target);
          if (!source || !target) return null;

          const sourceX = source.position.x + source.width / 2;
          const sourceY = source.position.y + source.height / 2;
          const targetX = target.position.x + target.width / 2;
          const targetY = target.position.y + target.height / 2;

          return (
            <line
              key={edge.id}
              x1={sourceX}
              y1={sourceY}
              x2={targetX}
              y2={targetY}
              stroke="#94a3b8"
              strokeWidth="3"
              strokeLinecap="round"
            />
          );
        })}
        {previewNodes.map((node) => {
          const label = typeof node.data.label === 'string' ? node.data.label : 'Node';
          const color = typeof node.data.color === 'string' ? node.data.color : '#ffffff';
          const textColor = typeof node.data.textColor === 'string' ? node.data.textColor : '#1e293b';
          const bold = node.data.bold === true;
          const italic = node.data.italic === true;
          const underline = node.data.underline === true;
          const shape = typeof node.data.shape === 'string' ? node.data.shape : 'rounded';
          const centerX = node.position.x + node.width / 2;
          const centerY = node.position.y + node.height / 2;
          const text = (
            <text
              x={centerX}
              y={centerY + 4}
              textAnchor="middle"
              fontSize="13"
              fontWeight={bold ? '700' : '600'}
              fontStyle={italic ? 'italic' : undefined}
              textDecoration={underline ? 'underline' : undefined}
              fill={textColor}
            >
              {label}
            </text>
          );

          if (shape === 'circle') {
            return (
              <g key={node.id}>
                <circle cx={centerX} cy={centerY} r={Math.max(node.width, node.height) / 2} fill={color} stroke="#cbd5e1" strokeWidth="2" />
                {text}
              </g>
            );
          }

          if (shape === 'diamond') {
            const points = `${centerX},${node.position.y} ${node.position.x + node.width},${centerY} ${centerX},${node.position.y + node.height} ${node.position.x},${centerY}`;
            return (
              <g key={node.id}>
                <polygon points={points} fill={color} stroke="#cbd5e1" strokeWidth="2" />
                {text}
              </g>
            );
          }

          return (
            <g key={node.id}>
              <rect x={node.position.x} y={node.position.y} width={node.width} height={node.height} rx={shape === 'rectangle' ? 0 : 12} fill={color} stroke="#cbd5e1" strokeWidth="2" />
              {text}
            </g>
          );
        })}
      </svg>
    </div>
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
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

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
        .select('id, title, updated_at, view_token, owner_token, nodes, edges')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false });

      if (!error && data) {
        const results: OwnedMap[] = data.map((row) => ({
          id: row.id,
          ownerToken: row.owner_token,
          title: row.title,
          updatedAt: row.updated_at,
          viewToken: row.view_token,
          nodes: parsePreviewNodes(row.nodes),
          edges: parsePreviewEdges(row.edges),
          thumbnail: localStorage.getItem(`mindmap_thumb_${row.id}`) || undefined,
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

  useEffect(() => {
    const userId = session?.user?.id;
    if (!isLoggedIn || migrated || !userId) return;

    async function migrateLocalMaps() {
      const keysToMigrate: { id: string; ownerToken: string }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('mindmap_owned_')) {
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
            localStorage.removeItem(`mindmap_owned_${id}`);
          } else if (error || !data) {
            localStorage.removeItem(`mindmap_owned_${id}`);
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
      router.push(`/map/${newId}?owner=${newOwnerToken}`);
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
        localStorage.removeItem(`mindmap_owned_${id}`);
      }
      setMaps((prev) => prev.filter((m) => m.id !== id));
      localStorage.removeItem(`mindmap_thumb_${id}`);
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
        id: newId, title: `${data.title} (copy)`, nodes: data.nodes, edges: data.edges,
        owner_token: newOwnerToken, edit_token: newEditToken, view_token: newViewToken,
      };
      if (session) insertData.user_id = session.user.id;

      const { error: insertError } = await supabase.from('mindmaps').insert(insertData);
      if (insertError) { console.error('Duplicate failed:', insertError); return; }
      if (!session) localStorage.setItem(`mindmap_owned_${newId}`, newOwnerToken);
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

  const filteredMaps = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const visible = term
      ? maps.filter((map) => map.title.toLowerCase().includes(term))
      : maps;

    return [...visible].sort((a, b) => {
      if (sortMode === 'az') return a.title.localeCompare(b.title);
      if (sortMode === 'oldest') return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [maps, searchTerm, sortMode]);

  const lastUpdatedLabel = useMemo(() => {
    if (maps.length === 0) return 'No maps yet';
    const newest = maps.reduce((latest, map) => (
      new Date(map.updatedAt).getTime() > new Date(latest.updatedAt).getTime() ? map : latest
    ));
    return formatDate(newest.updatedAt);
  }, [maps]);

  const templateCards: Array<{ label: string; description: string; template?: TemplateData }> = useMemo(() => [
    { label: 'Blank Mindmap', description: 'Start with one clean idea and branch freely.' },
    ...Object.values(TEMPLATES).map((template) => ({
      label: template.label,
      description: template.description,
      template,
    })),
  ], []);

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
        <section className="bg-mindmap-bg-primary border-b border-mindmap-border/30 px-6 py-10">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-mindmap-accent">Connodo Workspace</p>
                <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-mindmap-text-primary">Welcome back</h1>
                <p className="mt-3 max-w-xl text-mindmap-text-muted">
                  {isLoggedIn
                    ? 'Your saved mindmaps live here. Start from a template or continue where you left off.'
                    : 'Continue your saved mindmaps, start from a template, or draft something temporary in Guest Mode.'}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleCreate()}
                    disabled={creating}
                    className="rounded-xl bg-mindmap-accent px-6 py-3 text-sm font-semibold text-white hover:bg-mindmap-accent/80 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                  >
                    {creating ? 'Creating…' : '+ Create Saved Map'}
                  </button>
                  {!isLoggedIn && (
                    <button
                      type="button"
                      onClick={() => router.push('/guest')}
                      className="rounded-xl border border-mindmap-border/50 px-6 py-3 text-sm font-semibold text-mindmap-text-primary hover:bg-mindmap-accent/20 hover:text-white transition-colors"
                    >
                      Start Guest Draft
                    </button>
                  )}
                  <a
                    href="#templates"
                    className="rounded-xl border border-mindmap-border/30 px-6 py-3 text-sm font-semibold text-mindmap-text-muted hover:bg-mindmap-accent/10 hover:text-white transition-colors"
                  >
                    Browse Templates
                  </a>
                </div>
                {createError && <p className="text-red-400 text-sm mt-3">{createError}</p>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-mindmap-border/30 bg-mindmap-bg-secondary/50 p-4">
                  <p className="text-xs text-mindmap-text-muted">Saved maps</p>
                  <p className="mt-2 text-lg font-bold text-mindmap-text-primary">{String(maps.length)}</p>
                </div>
                <div className="rounded-2xl border border-mindmap-border/30 bg-mindmap-bg-secondary/50 p-4">
                  <p className="text-xs text-mindmap-text-muted">Visible</p>
                  <p className="mt-2 text-lg font-bold text-mindmap-text-primary">{String(filteredMaps.length)}</p>
                </div>
                <div className="rounded-2xl border border-mindmap-border/30 bg-mindmap-bg-secondary/50 p-4">
                  <p className="text-xs text-mindmap-text-muted">Last updated</p>
                  <p className="mt-2 text-sm font-bold text-mindmap-text-primary leading-snug">{lastUpdatedLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="templates" className="max-w-6xl mx-auto px-6 pt-8">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-mindmap-text-primary">Start from a template</h2>
              <p className="mt-1 text-sm text-mindmap-text-muted">Pick a structure and customize it freely.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {templateCards.slice(0, 5).map((template) => (
              <button
                key={template.label}
                type="button"
                onClick={() => handleCreate(template.template)}
                disabled={creating}
                className="group rounded-2xl border border-mindmap-border/30 bg-mindmap-bg-primary p-4 text-left shadow-lg transition-all hover:-translate-y-0.5 hover:border-mindmap-accent disabled:opacity-60"
              >
                <div className="mb-4 h-16 rounded-xl border border-mindmap-border/20 bg-mindmap-bg-secondary/70 flex items-center justify-center text-2xl">
                  {template.template ? '🌿' : '＋'}
                </div>
                <h3 className="text-sm font-semibold text-mindmap-text-primary group-hover:text-white transition-colors">{template.label}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-mindmap-text-muted">{template.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto p-6 pt-8">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-mindmap-text-primary">Saved Mindmaps</h2>
              <p className="mt-1 text-sm text-mindmap-text-muted">Search, sort, and reopen your saved branches.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search mindmaps..."
                className="w-full sm:w-72 rounded-xl border border-mindmap-border/40 bg-mindmap-bg-primary px-4 py-2.5 text-sm text-mindmap-text-primary outline-none placeholder:text-mindmap-text-muted focus:border-mindmap-accent"
              />
              <div className="relative">
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="w-full appearance-none rounded-xl border border-mindmap-border/40 bg-mindmap-bg-primary px-4 py-2.5 pr-10 text-sm text-mindmap-text-primary outline-none focus:border-mindmap-accent"
                >
                  <option value="recent">Recently updated</option>
                  <option value="az">A-Z</option>
                  <option value="oldest">Oldest first</option>
                </select>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mindmap-text-primary"
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <p className="text-mindmap-text-muted text-sm animate-pulse">Loading your maps…</p>
            </div>
          ) : maps.length === 0 ? (
            <div className="rounded-3xl border border-mindmap-border/30 bg-mindmap-bg-primary p-10 text-center shadow-lg">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-mindmap-accent/15 text-3xl">🌿</div>
              <h3 className="text-xl font-semibold text-mindmap-text-primary">No saved mindmaps yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-mindmap-text-muted">
                Your ideas are waiting for a place to branch. Create a saved map for auto-save and sharing, or try Guest Mode for a temporary draft.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleCreate()}
                  disabled={creating}
                  className="rounded-xl bg-mindmap-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-mindmap-accent/80 transition-colors disabled:opacity-60"
                >
                  Create Saved Map
                </button>
                {!isLoggedIn && (
                  <button
                    type="button"
                    onClick={() => router.push('/guest')}
                    className="rounded-xl border border-mindmap-border/50 px-5 py-2.5 text-sm font-semibold text-mindmap-text-primary hover:bg-mindmap-accent/20 hover:text-white transition-colors"
                  >
                    Try Guest Mode
                  </button>
                )}
              </div>
            </div>
          ) : filteredMaps.length === 0 ? (
            <div className="rounded-3xl border border-mindmap-border/30 bg-mindmap-bg-primary p-10 text-center shadow-lg">
              <h3 className="text-lg font-semibold text-mindmap-text-primary">No matching mindmaps</h3>
              <p className="mt-2 text-sm text-mindmap-text-muted">Try another search term or clear the search box.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredMaps.map((map) => (
                <div
                  key={map.id}
                  className="flex flex-col rounded-2xl bg-mindmap-bg-primary border border-mindmap-border/30 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 hover:border-mindmap-accent overflow-hidden"
                >
                  <MindMapCardPreview nodes={map.nodes} edges={map.edges} title={map.title} />
                  <div className="p-5 flex flex-col flex-1">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-mindmap-accent/15 px-2.5 py-1 text-[11px] font-semibold text-mindmap-text-primary">Saved</span>
                      <span className="text-[11px] text-mindmap-text-muted">Private owner link</span>
                    </div>
                    <InlineRenameTitle
                      mapId={map.id} ownerToken={map.ownerToken} initialTitle={map.title}
                      onRenameOptimistic={handleRenameOptimistic} session={session}
                    />
                    <p className="text-xs text-mindmap-text-muted mb-5">
                      Updated {formatDate(map.updatedAt)}
                    </p>
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 mt-auto">
                      <button
                        type="button"
                        onClick={() => router.push(`/map/${map.id}?owner=${map.ownerToken}`)}
                        className="rounded-lg bg-mindmap-accent px-3 py-2 text-xs font-medium text-white hover:bg-mindmap-accent/80 transition-colors shadow-sm"
                      >
                        Open &rarr;
                      </button>
                      <button
                        type="button"
                        onClick={() => window.open(`/map/${map.id}?view=${map.viewToken}`, '_blank')}
                        className="rounded-lg bg-mindmap-bg-secondary border border-mindmap-border/50 px-3 py-2 text-xs font-medium text-mindmap-text-primary hover:bg-mindmap-accent/30 transition-colors shadow-sm"
                        title="Preview as viewer"
                      >
                        👁
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(map.id, map.ownerToken)}
                        disabled={duplicatingId === map.id}
                        className="rounded-lg bg-mindmap-bg-secondary border border-mindmap-border/50 px-3 py-2 text-xs font-medium text-mindmap-text-primary hover:bg-mindmap-accent/30 transition-colors shadow-sm disabled:opacity-50"
                        title="Duplicate map"
                      >
                        {duplicatingId === map.id ? '…' : '📋'}
                      </button>
                      <button
                        type="button"
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
