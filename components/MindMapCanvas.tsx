'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
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
  _autoEdit?: boolean;
}

export type MindMapNode = Node<MindMapNodeData>;
export type MindMapEdge = Edge;

type Snapshot = { nodes: MindMapNode[]; edges: MindMapEdge[] };

// ---------------------------------------------------------------------------
// Context — quick-add handler passed from CanvasInner to node components
// ---------------------------------------------------------------------------

const QuickAddContext = createContext<((sourceId: string) => void) | null>(null);
const UndoRedoContext = createContext<(() => void) | null>(null);

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
  const { setNodes, setEdges } = useReactFlow<MindMapNode, MindMapEdge>();
  const onQuickAdd = useContext(QuickAddContext);
  const pushSnapshot = useContext(UndoRedoContext);

  const bgColor = typeof data.color === 'string' ? data.color : '#ffffff';
  const showMiniToolbar = selected && !editing;

  // Auto-enter edit mode for nodes created via quick-add
  useEffect(() => {
    if (data._autoEdit) {
      setEditing(true);
      // Clear the flag so it doesn't re-trigger
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, _autoEdit: undefined } } : n
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data._autoEdit]);

  function handleLabelChange(newLabel: string) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n
      )
    );
  }

  function handleColorChange(color: string) {
    pushSnapshot?.();
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, color } } : n
      )
    );
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    pushSnapshot?.();
    setEditing(true);
  }

  function handleQuickAddClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    onQuickAdd?.(id);
  }

  function handleDeleteThis(e: React.MouseEvent) {
    e.stopPropagation();
    pushSnapshot?.();
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    setNodes((nds) => nds.filter((n) => n.id !== id));
  }

  function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation();
    pushSnapshot?.();
    const newId = `node-${Date.now()}`;
    setNodes((nds) => {
      const source = nds.find((n) => n.id === id);
      if (!source) return nds;
      const dup: MindMapNode = {
        id: newId,
        type: 'mindmap',
        position: { x: source.position.x + 30, y: source.position.y + 30 },
        data: { label: source.data.label, color: source.data.color },
      };
      return [
        ...nds.map((n) => ({ ...n, selected: false })),
        { ...dup, selected: true },
      ];
    });
  }

  const label = typeof data.label === 'string' ? data.label : 'Node';

  return (
    <div
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        'rounded-xl border-2 shadow-sm transition-shadow cursor-default relative',
        selected ? 'border-blue-400 shadow-md' : 'border-slate-200 hover:border-slate-300',
      ].join(' ')}
      style={{ minWidth: 80, backgroundColor: bgColor }}
    >
      {/* Target handle — left side (incoming edges) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-slate-300 !border-slate-400"
      />

      <NodeEditor
        value={label}
        onChange={handleLabelChange}
        editing={editing}
        onEditingChange={setEditing}
        readOnly={false}
      />
      {showMiniToolbar && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 flex items-center gap-1 px-2 py-1.5 bg-white rounded-lg shadow-md border border-slate-200 z-10"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleDeleteThis}
            className="p-1 rounded hover:bg-red-50 hover:text-red-600 transition-colors text-slate-500"
            title="Delete node"
          >
            <span className="text-sm">🗑</span>
          </button>
          <button
            type="button"
            onClick={handleDuplicate}
            className="p-1 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors text-slate-500"
            title="Duplicate node (Ctrl+D)"
          >
            <span className="text-sm">📋</span>
          </button>
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
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

      {/* Source handle — right side, styled as "+" quick-add button */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-5 !h-5 !bg-slate-800 !border-2 !border-white !rounded-full !right-[-10px]"
        style={{
          opacity: hovered || selected ? 1 : 0,
          transition: 'opacity 150ms',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={handleQuickAddClick}
      >
        <span
          className="text-white text-xs font-bold leading-none pointer-events-none select-none"
          style={{ fontSize: 12 }}
        >
          +
        </span>
      </Handle>
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
      {/* Target handle — left side (incoming edges) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-slate-300 !border-slate-400"
      />
      <NodeEditor value={label} readOnly />
      {/* Source handle — right side (for edge rendering, hidden) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-slate-300 !border-slate-400"
      />
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

  // Undo/redo history
  const MAX_HISTORY = 20;
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const nodesRef = useRef<MindMapNode[]>(nodes);
  const edgesRef = useRef<MindMapEdge[]>(edges);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Copy-paste clipboard (local, not system clipboard)
  const clipboardRef = useRef<{ nodes: MindMapNode[] }>({ nodes: [] });
  const pasteCountRef = useRef(0);

  const pushSnapshot = useCallback(() => {
    pastRef.current = [
      ...pastRef.current.slice(-(MAX_HISTORY - 1)),
      { nodes: nodesRef.current, edges: edgesRef.current },
    ];
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  function undo() {
    if (pastRef.current.length === 0) return;
    const prev = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [
      ...futureRef.current,
      { nodes: nodesRef.current, edges: edgesRef.current },
    ];
    setNodes(prev.nodes);
    setEdges(prev.edges);
    debouncedSave(prev.nodes, prev.edges);
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(true);
  }

  function redo() {
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [
      ...pastRef.current,
      { nodes: nodesRef.current, edges: edgesRef.current },
    ];
    setNodes(next.nodes);
    setEdges(next.edges);
    debouncedSave(next.nodes, next.edges);
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
  }

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
      pushSnapshot();
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
  // Watch for label/color/node changes from the custom node (setNodes called
  // directly). We fire a debounced save whenever `nodes` changes after load.
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
    pushSnapshot();
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
  // Double-click empty canvas — create node at click position
  // -------------------------------------------------------------------------
  function handleCanvasDoubleClick(e: React.MouseEvent) {
    if (!canEdit) return;
    const target = e.target as HTMLElement;
    if (!target.classList.contains('react-flow__pane')) return;

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    pushSnapshot();

    const newNode: MindMapNode = {
      id: `node-${Date.now()}`,
      type: 'mindmap',
      position,
      data: { label: 'New Node', _autoEdit: true },
    };

    setNodes((nds) => {
      const updated = [...nds, newNode];
      debouncedSave(updated, edges);
      return updated;
    });
  }

  // -------------------------------------------------------------------------
  // Quick-add — "+" button on node creates child node + edge
  // -------------------------------------------------------------------------
  const handleQuickAdd = useCallback(
    (sourceId: string) => {
      pushSnapshot();
      const newId = `node-${Date.now()}`;

      setNodes((nds) => {
        const sourceNode = nds.find((n) => n.id === sourceId);
        if (!sourceNode) return nds;

        const newNode: MindMapNode = {
          id: newId,
          type: 'mindmap',
          position: {
            x: sourceNode.position.x + 250,
            y: sourceNode.position.y,
          },
          data: { label: 'New Node', _autoEdit: true },
        };

        return [...nds, newNode];
      });

      setEdges((eds) => [
        ...eds,
        {
          id: `edge-${sourceId}-${newId}`,
          source: sourceId,
          target: newId,
          type: 'smoothstep',
        },
      ]);
    },
    []
  );

  // -------------------------------------------------------------------------
  // Delete selected nodes/edges (toolbar button + Delete key)
  // -------------------------------------------------------------------------
  function handleDeleteSelected() {
    pushSnapshot();
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
  // Keyboard handler — shortcuts for fast node creation & editing
  // -------------------------------------------------------------------------
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Guard: never fire shortcuts while typing inside a NodeEditor textarea
    const active = document.activeElement;
    const isTextInput =
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement;

    // --- Escape: deselect all (works even in read-only) ---
    if (e.key === 'Escape') {
      e.preventDefault();
      setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
      setEdges((eds) => eds.map((ed) => ({ ...ed, selected: false })));
      return;
    }

    if (!canEdit) return;
    if (isTextInput) return;

    const selectedNode = nodes.find((n) => n.selected);

    // --- Ctrl+A / Cmd+A: select all nodes ---
    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
      return;
    }

    // --- Ctrl+Z: undo ---
    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }

    // --- Ctrl+Shift+Z / Ctrl+Y: redo ---
    if (
      (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
      (e.key === 'y' && (e.ctrlKey || e.metaKey))
    ) {
      e.preventDefault();
      redo();
      return;
    }

    // --- Ctrl+C: copy selected nodes ---
    if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const selected = nodes.filter((n) => n.selected);
      if (selected.length > 0) {
        clipboardRef.current = { nodes: selected };
        pasteCountRef.current = 0;
      }
      return;
    }

    // --- Ctrl+V: paste copied nodes ---
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const clip = clipboardRef.current;
      if (clip.nodes.length === 0) return;
      pasteCountRef.current += 1;
      const offset = pasteCountRef.current * 30;
      pushSnapshot();
      const newNodes: MindMapNode[] = clip.nodes.map((n) => ({
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'mindmap' as const,
        position: { x: n.position.x + offset, y: n.position.y + offset },
        data: { label: n.data.label, color: n.data.color },
      }));
      setNodes((nds) => [
        ...nds.map((nd) => ({ ...nd, selected: false })),
        ...newNodes.map((nd) => ({ ...nd, selected: true })),
      ]);
      return;
    }
    // --- Delete / Backspace: delete selected ---
    if (e.key === 'Delete' || e.key === 'Backspace') {
      handleDeleteSelected();
      return;
    }

    if (!selectedNode) return;

    // --- Ctrl+D: duplicate selected node ---
    if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      pushSnapshot();
      const newId = `node-${Date.now()}`;
      setNodes((nds) => {
        const source = nds.find((n) => n.id === selectedNode.id);
        if (!source) return nds;
        const dup: MindMapNode = {
          id: newId,
          type: 'mindmap',
          position: { x: source.position.x + 30, y: source.position.y + 30 },
          data: { label: source.data.label, color: source.data.color },
        };
        return [
          ...nds.map((n) => ({ ...n, selected: false })),
          { ...dup, selected: true },
        ];
      });
      return;
    }

    // --- F2: enter edit mode on selected node ---
    if (e.key === 'F2') {
      e.preventDefault();
      pushSnapshot();
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? { ...n, data: { ...n.data, _autoEdit: true } }
            : n
        )
      );
      return;
    }

    // --- Tab: create child node (X + 250, same Y) ---
    if (e.key === 'Tab') {
      e.preventDefault();
      pushSnapshot();
      const childId = `node-${Date.now()}`;
      const childNode: MindMapNode = {
        id: childId,
        type: 'mindmap',
        position: {
          x: selectedNode.position.x + 250,
          y: selectedNode.position.y,
        },
        data: { label: 'New Node', _autoEdit: true },
      };
      setNodes((nds) => [
        ...nds.map((n) => ({ ...n, selected: false })),
        { ...childNode, selected: true },
      ]);
      setEdges((eds) => [
        ...eds,
        {
          id: `edge-${selectedNode.id}-${childId}`,
          source: selectedNode.id,
          target: childId,
          type: 'smoothstep',
        },
      ]);
      return;
    }

    // --- Enter: create sibling node (same X, Y + 100) ---
    if (e.key === 'Enter') {
      e.preventDefault();
      pushSnapshot();
      const siblingId = `node-${Date.now()}`;
      const siblingNode: MindMapNode = {
        id: siblingId,
        type: 'mindmap',
        position: {
          x: selectedNode.position.x,
          y: selectedNode.position.y + 100,
        },
        data: { label: 'New Node', _autoEdit: true },
      };
      setNodes((nds) => [
        ...nds.map((n) => ({ ...n, selected: false })),
        { ...siblingNode, selected: true },
      ]);
      setEdges((eds) => [
        ...eds,
        {
          id: `edge-${selectedNode.id}-${siblingId}`,
          source: selectedNode.id,
          target: siblingId,
          type: 'smoothstep',
        },
      ]);
      return;
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
    <UndoRedoContext.Provider value={pushSnapshot}>
    <QuickAddContext.Provider value={handleQuickAdd}>
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
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <div className="flex-1 relative" ref={flowWrapperRef} onDoubleClick={handleCanvasDoubleClick}>
        <ReactFlow<MindMapNode, MindMapEdge>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={canEdit ? onConnect : undefined}
          onNodeDragStart={canEdit ? () => pushSnapshot() : undefined}
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
    </QuickAddContext.Provider>
    </UndoRedoContext.Provider>
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
