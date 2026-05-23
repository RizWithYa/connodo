'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  ReactFlowProvider,
  } from '@xyflow/react';
  import type {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  NodeTypes,
  Connection,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { supabase, createTokenClient } from '@/lib/supabase';
import { useDebounce } from '@/lib/useDebounce';
import NodeEditor from '@/components/NodeEditor';
import Toolbar from '@/components/Toolbar';
import SharePanel from '@/components/SharePanel';
import MapTitle from '@/components/MapTitle';
import { exportAsPng, exportAsPdf, exportAsJson } from '@/lib/exportUtils';
import type { AccessRole } from '@/lib/tokenUtils';

// ---------------------------------------------------------------------------
// Types — MindMap-specific node data
  // ---------------------------------------------------------------------------

export interface MindMapNodeData extends Record<string, unknown> {
  label: string;
  color?: string;
}

export type MindMapNode = Node<MindMapNodeData>;
export type MindMapEdge = Edge;

// ---------------------------------------------------------------------------
// Custom node — editable (owner / editor)
  // In @xyflow/react v12 NodeProps generic is Node<DataType>, not DataType
  // ---------------------------------------------------------------------------

const PRESET_COLORS = [
  '#ffffff', '#fef08a', '#bbf7d0', '#bfdbfe',
  '#fecaca', '#e9d5ff', '#fed7aa', '#f1f5f9',
];

function MindMapNodeEditable(props: NodeProps<MindMapNode>) {
  const { id, data, selected } = props;
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { setNodes } = useReactFlow<MindMapNode, MindMapEdge>();

  const bgColor = typeof data.color === 'string' ? data.color : '#ffffff';
  const showSwatches = hovered || selected;

  function handleLabelChange(newLabel: string) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n
      )
    );
  }

  function handleColorChange(color: string) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, color } } : n
      )
    );
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setEditing(true);
  }

  const label = typeof data.label === 'string' ? data.label : 'Node';

  return (
    <div
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        'rounded-xl border-2 shadow-sm transition-shadow cursor-default',
        selected ? 'border-blue-400 shadow-md' : 'border-slate-200 hover:border-slate-300',
      ].join(' ')}
      style={{ minWidth: 80, backgroundColor: bgColor }}
    >
      <NodeEditor
        value={label}
        onChange={handleLabelChange}
        editing={editing}
        onEditingChange={setEditing}
        readOnly={false}
      />
      {showSwatches && (
        <div
          className="flex gap-1 px-2 pb-2 justify-center"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleColorChange(c);
              }}
              className={[
                'w-4 h-4 rounded-full border transition-transform hover:scale-125',
                c === bgColor ? 'border-blue-500 ring-1 ring-blue-400' : 'border-slate-300',
              ].join(' ')}
              style={{ backgroundColor: c }}
              aria-label={`Set node color to ${c}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom node — read-only (viewer)
// ---------------------------------------------------------------------------

    function MindMapNodeReadOnly(props: NodeProps<MindMapNode>) {
  const { data } = props;
  const label = typeof data.label === 'string' ? data.label : 'Node';
  const bgColor = typeof data.color === 'string' ? data.color : '#ffffff';

  return (
    <div
      className="rounded-xl border-2 border-slate-200 shadow-sm cursor-default"
      style={{ minWidth: 80, backgroundColor: bgColor }}
    >
      <NodeEditor value={label} readOnly />
    </div>
  );
}

  // ---------------------------------------------------------------------------
  // Inner canvas component (must be inside ReactFlowProvider)
  // ---------------------------------------------------------------------------

interface CanvasInnerProps {
  mapId: string;
  tokenColumn: 'owner_token' | 'edit_token' | 'view_token' | null;
  token: string | null;
  role: AccessRole;
  }

  function CanvasInner({ mapId, tokenColumn, token, role }: CanvasInnerProps) {
  const router = useRouter();

  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [edges, setEdges] = useState<MindMapEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Title + owner share tokens (fetched only for owner)
  const [title, setTitle] = useState('Untitled Map');
  const [viewToken, setViewToken] = useState('');
  const [editToken, setEditToken] = useState('');
  const [ownerToken, setOwnerToken] = useState('');

  // Share panel visibility
  const [showSharePanel, setShowSharePanel] = useState(false);

  // Ref to the React Flow wrapper for export
  const flowWrapperRef = useRef<HTMLDivElement>(null);

  const { screenToFlowPosition, fitView } = useReactFlow<MindMapNode, MindMapEdge>();

  const canEdit = role === 'owner' || role === 'editor';
  const readOnly = !canEdit;

  const nodeTypes: NodeTypes = {
    mindmap: readOnly ? MindMapNodeReadOnly : MindMapNodeEditable,
  };

  // -------------------------------------------------------------------------
  // Load map data on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    async function loadMap() {
      setLoading(true);
      setError(null);

      try {
        // 1. Resolve the token (URL props vs localStorage)
        let activeColumn = tokenColumn;
        let activeToken = token;

        if (!activeToken && typeof window !== 'undefined') {
          const storedToken = localStorage.getItem(`mindmap_owned_${mapId}`);
          if (storedToken) {
            activeColumn = 'owner_token';
            activeToken = storedToken;
          }
        }

        // 2. Build the query to explicitly filter by the resolved token
        const client = activeToken ? createTokenClient(activeToken) : supabase;

        let query = client
          .from('mindmaps')
          .select('*')
          .eq('id', mapId);

        if (activeColumn && activeToken) {
          query = query.eq(activeColumn, activeToken);
        } else {
          // If absolutely no token is provided, we should ideally fail or let RLS reject.
          // For safety, we can explicitly add an impossible condition if anon reads are strictly token-gated.
          // But we'll let RLS / DB handle the empty state.
        }

        const { data, error: fetchError } = await query.single();

        if (fetchError) {
          setError('Map not found or access denied.');
          return;
        }

        const rawNodes = ((data.nodes ?? []) as MindMapNode[]).map((n) => ({
          ...n,
          type: 'mindmap' as const,
        }));
        const rawEdges = (data.edges ?? []) as MindMapEdge[];

        setNodes(rawNodes);
        setEdges(rawEdges);

        if (data.title) setTitle(data.title as string);

        // Only owner receives these columns
        if (role === 'owner') {
          if (data.view_token) setViewToken(data.view_token as string);
          if (data.edit_token) setEditToken(data.edit_token as string);
          if (data.owner_token) setOwnerToken(data.owner_token as string);
        }
      } catch (e) {
        setError('Failed to load map.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    loadMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  // -------------------------------------------------------------------------
  // Auto-fit on initial load — once only, with smooth animation
  // -------------------------------------------------------------------------
  const hasFittedView = useRef(false);
  useEffect(() => {
    if (!loading && !error && nodes.length > 0 && !hasFittedView.current) {
      hasFittedView.current = true;
      // Allow React Flow one frame to measure node dimensions
      requestAnimationFrame(() => {
        fitView({ padding: 0.2, duration: 400 });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // -------------------------------------------------------------------------
  // Debounced save — 1500ms after last change (per spec)
  // -------------------------------------------------------------------------
  const persistSave = useCallback(
    async (nodesToSave: MindMapNode[], edgesToSave: MindMapEdge[]) => {
      setSaveStatus('saving');
      try {
        const client = token ? createTokenClient(token) : supabase;
        let query = client
          .from('mindmaps')
          .update({
            nodes: nodesToSave,
            edges: edgesToSave,
            updated_at: new Date().toISOString(),
          })
          .eq('id', mapId);

        if (tokenColumn && token) {
          query = query.eq(tokenColumn, token);
        }

        const { error: saveError } = await query;

        if (saveError) {
          console.error('Save failed:', saveError);
          setSaveStatus('error');
        } else {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        }
      } catch (e) {
        console.error('Save exception:', e);
        setSaveStatus('error');
      }
    },
    [mapId, tokenColumn, token]
  );

  const debouncedSave = useDebounce(persistSave, 1500);

  // -------------------------------------------------------------------------
  // React Flow change handlers
  // -------------------------------------------------------------------------
  const onNodesChange: OnNodesChange<MindMapNode> = useCallback(
    (changes) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        if (canEdit) debouncedSave(updated, edges);
        return updated;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, debouncedSave, edges]
  );

  const onEdgesChange: OnEdgesChange<MindMapEdge> = useCallback(
    (changes) => {
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds);
        if (canEdit) debouncedSave(nodes, updated);
        return updated;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, debouncedSave, nodes]
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const updated = addEdge({ ...connection, type: 'smoothstep' }, eds);
        debouncedSave(nodes, updated);
        return updated;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedSave, nodes]
  );

  // -------------------------------------------------------------------------
  // Watch for label changes from the custom node (setNodes called directly).
  // We fire a debounced save whenever `nodes` changes after initial load.
  // -------------------------------------------------------------------------
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (canEdit && !loading) {
      debouncedSave(nodes, edges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // -------------------------------------------------------------------------
  // Add node — placed at current viewport center
  // -------------------------------------------------------------------------
  function handleAddNode() {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const newNode: MindMapNode = {
      id: `node-${Date.now()}`,
      type: 'mindmap',
      position,
      data: { label: 'New Node' },
    };

    setNodes((nds) => {
      const updated = [...nds, newNode];
      debouncedSave(updated, edges);
      return updated;
    });
  }

  // -------------------------------------------------------------------------
  // Delete selected nodes/edges (toolbar button + Delete key)
  // -------------------------------------------------------------------------
  function handleDeleteSelected() {
    let remainingNodes: MindMapNode[] = [];
    let remainingEdges: MindMapEdge[] = [];

    setNodes((nds) => {
      const selectedIds = new Set(nds.filter((n) => n.selected).map((n) => n.id));
      remainingNodes = nds.filter((n) => !n.selected);

      setEdges((eds) => {
        remainingEdges = eds.filter(
          (e) => !e.selected && !selectedIds.has(e.source) && !selectedIds.has(e.target)
        );
        return remainingEdges;
      });

      return remainingNodes;
    });

    // Save after React state flushes
    setTimeout(() => {
      if (canEdit) debouncedSave(remainingNodes, remainingEdges);
    }, 0);
  }

  // -------------------------------------------------------------------------
  // Delete map (owner only) — called from SharePanel
  // -------------------------------------------------------------------------
  async function handleDeleteMap() {
    if (role !== 'owner' || !token) return;

    try {
      const client = createTokenClient(token);
      const { error: deleteError } = await client
        .from('mindmaps')
        .delete()
        .eq('id', mapId)
        .eq('owner_token', token);

      if (deleteError) {
        console.error('Delete failed:', deleteError);
        return;
      }

      // Clean up localStorage entry
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`mindmap_owned_${mapId}`);
      }

      router.push('/');
    } catch (e) {
      console.error('Delete exception:', e);
    }
  }

  // -------------------------------------------------------------------------
  // Export handlers — wired to exportUtils
  // -------------------------------------------------------------------------
  async function handleExportPng() {
    const el = flowWrapperRef.current;
    if (!el) return;
    await exportAsPng(el, title || 'mindmap');
  }

  async function handleExportPdf() {
    const el = flowWrapperRef.current;
    if (!el) return;
    await exportAsPdf(el, title || 'mindmap');
  }

  function handleExportJson() {
    exportAsJson(title, nodes, edges, title || 'mindmap');
  }

  // -------------------------------------------------------------------------
  // Keyboard handler — Delete / Backspace when no text input is focused
  // -------------------------------------------------------------------------
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!canEdit) return;
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;

    const active = document.activeElement;
    const isTextInput =
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement;
    if (!isTextInput) {
      handleDeleteSelected();
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <p className="text-slate-400 text-sm animate-pulse">Loading map…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-white">
        <p className="text-red-500 text-sm font-medium">{error}</p>
        <p className="text-slate-400 text-xs">Check that your link is correct and try again.</p>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex flex-col outline-none"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Title bar */}
      <MapTitle
        mapId={mapId}
        initialTitle={title}
        canRename={role === 'owner'}
        ownerToken={role === 'owner' ? token : null}
      />

      <Toolbar
        canEdit={canEdit}
        isOwner={role === 'owner'}
        onAddNode={handleAddNode}
        onDeleteSelected={handleDeleteSelected}
        onShare={() => setShowSharePanel(true)}
        onExportPng={handleExportPng}
        onExportPdf={handleExportPdf}
        onExportJson={handleExportJson}
        saveStatus={saveStatus}
      />

      <div className="flex-1 relative" ref={flowWrapperRef}>
        <ReactFlow<MindMapNode, MindMapEdge>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={canEdit ? onConnect : undefined}
          nodeTypes={nodeTypes}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          zoomOnScroll
          panOnDrag
          defaultEdgeOptions={{ type: 'smoothstep' }}
          deleteKeyCode={null}
        >
          <Background color="#f1f5f9" gap={20} />
          <Controls />
          <MiniMap
            nodeStrokeColor="#94a3b8"
            nodeColor="#ffffff"
            maskColor="rgba(241,245,249,0.7)"
          />
        </ReactFlow>

        {canEdit && saveStatus !== 'idle' && (
          <div
            className={[
              'absolute bottom-4 right-4 z-10 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm',
              saveStatus === 'saving' ? 'bg-slate-100 text-slate-500' : '',
              saveStatus === 'saved' ? 'bg-green-50 text-green-600 border border-green-200' : '',
              saveStatus === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : '',
            ].join(' ')}
          >
            {saveStatus === 'saving' && '⏳ Saving…'}
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'error' && '✗ Save failed'}
          </div>
        )}

        <div className="absolute top-3 left-3 z-10 px-2 py-1 rounded-md bg-white/80 border border-slate-200 text-xs text-slate-500 backdrop-blur-sm pointer-events-none">
          {role === 'owner' && '👑 Owner'}
          {role === 'editor' && '✏️ Editor'}
          {role === 'viewer' && '👁 View only'}
        </div>
      </div>

      {/* Share panel — owner only */}
      {showSharePanel && role === 'owner' && (
        <SharePanel
          mapId={mapId}
          viewToken={viewToken}
          editToken={editToken}
          ownerToken={ownerToken}
          onClose={() => setShowSharePanel(false)}
          onDelete={handleDeleteMap}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export — wraps CanvasInner in ReactFlowProvider
// ---------------------------------------------------------------------------

export interface MindMapCanvasProps {
  mapId: string;
  tokenColumn: 'owner_token' | 'edit_token' | 'view_token' | null;
  token: string | null;
  role: AccessRole;
}

export default function MindMapCanvas(props: MindMapCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
