'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, useMemo } from 'react';
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
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from '@xyflow/react';
  import type {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  NodeTypes,
  EdgeTypes,
  Connection,
  NodeProps,
  EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { supabase, createTokenClient, getSession } from '@/lib/supabase';
import { useDebounce } from '@/lib/useDebounce';
import NodeEditor from '@/components/NodeEditor';
import Toolbar from '@/components/Toolbar';
import SharePanel from '@/components/SharePanel';
import MapTitle from '@/components/MapTitle';
import { exportAsPng, exportAsPdf, exportAsJson } from '@/lib/exportUtils';
import type { AccessRole } from '@/lib/tokenUtils';
import CommentPanel from '@/components/CommentPanel';
import {
  Trash2,
  Copy,
  X,
  Loader2,
  Check,
  AlertCircle,
  AlertTriangle,
  Crown,
  Pencil,
  Eye,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types — MindMap-specific node data
  // ---------------------------------------------------------------------------

export interface MindMapNodeData extends Record<string, unknown> {
  label: string;
  color?: string;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  shape?: string;
  _autoEdit?: boolean;
}

export type MindMapNode = Node<MindMapNodeData>;
export type MindMapEdge = Edge;

type Snapshot = { nodes: MindMapNode[]; edges: MindMapEdge[] };

// ---------------------------------------------------------------------------
// Types & Context — quick-add direction + handler contexts
// ---------------------------------------------------------------------------

type QuickAddDirection = 'right' | 'left' | 'top' | 'bottom';

const DIRECTION_OFFSETS: Record<QuickAddDirection, { x: number; y: number; sourceHandle: string; targetHandle: string }> = {
  right: { x: 250, y: 0, sourceHandle: 'source-right', targetHandle: 'target-left' },
  left: { x: -250, y: 0, sourceHandle: 'source-left', targetHandle: 'target-right' },
  bottom: { x: 0, y: 120, sourceHandle: 'source-bottom', targetHandle: 'target-top' },
  top: { x: 0, y: -120, sourceHandle: 'source-top', targetHandle: 'target-bottom' },
};

const QuickAddContext = createContext<((sourceId: string, direction: QuickAddDirection) => void) | null>(null);
const UndoRedoContext = createContext<(() => void) | null>(null);

// ---------------------------------------------------------------------------
// Custom node — editable (owner / editor)
  // In @xyflow/react v12 NodeProps generic is Node<DataType>, not DataType
  // ---------------------------------------------------------------------------

const PRESET_COLORS = [
  '#ffffff', '#fef08a', '#bbf7d0', '#bfdbfe',
  '#fecaca', '#e9d5ff', '#fed7aa', '#f1f5f9',
];

const TEXT_COLORS = ['#1e293b', '#ffffff', '#dc2626', '#2563eb', '#16a34a', '#9333ea'];
type TextStyleKey = 'bold' | 'italic' | 'underline';

function MindMapNodeEditable(props: NodeProps<MindMapNode>) {
  const { id, data, selected } = props;
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { setNodes, setEdges } = useReactFlow<MindMapNode, MindMapEdge>();
  const onQuickAdd = useContext(QuickAddContext);
  const pushSnapshot = useContext(UndoRedoContext);

  const bgColor = typeof data.color === 'string' ? data.color : '#ffffff';
  const textColor = typeof data.textColor === 'string' ? data.textColor : '#1e293b';
  const bold = data.bold === true;
  const italic = data.italic === true;
  const underline = data.underline === true;
  const showMiniToolbar = selected && !editing;
  const showControls = hovered || selected;

  // Auto-enter edit mode for nodes created via quick-add
  useEffect(() => {
    if (data._autoEdit) {
      setEditing(true);
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

  function handleShapeChange(newShape: string) {
    pushSnapshot?.();
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, shape: newShape } } : n
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

  function handleTextColorChange(textColor: string) {
    pushSnapshot?.();
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, textColor } } : n
      )
    );
  }

  function handleTextStyleToggle(style: TextStyleKey) {
    pushSnapshot?.();
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, [style]: n.data[style] !== true } } : n
      )
    );
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    pushSnapshot?.();
    setEditing(true);
  }

  function handleQuickAddDir(e: React.MouseEvent, direction: QuickAddDirection) {
    e.stopPropagation();
    e.preventDefault();
    onQuickAdd?.(id, direction);
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
        data: { ...source.data, _autoEdit: undefined },
      };
      return [
        ...nds.map((n) => ({ ...n, selected: false })),
        { ...dup, selected: true },
      ];
    });
  }

  const label = typeof data.label === 'string' ? data.label : 'Node';

  const handleDotStyle = showControls
    ? '!w-1.5 !h-1.5 !bg-slate-400 !border-slate-400 !rounded-full !min-w-0 !min-h-0'
    : '!w-0 !h-0 !bg-transparent !border-0 !min-w-0 !min-h-0';

  const shape = typeof data.shape === 'string' ? data.shape : 'rounded';
  const searchMatch = data._searchMatch as boolean | undefined;
  const searchDimmed = data._searchDimmed as boolean | undefined;

  let rootClasses = 'transition-shadow cursor-default relative ';
  if (searchMatch) rootClasses += 'ring-2 ring-blue-500 z-50 ';
  if (searchDimmed) rootClasses += 'opacity-30 ';
  let rootStyle: React.CSSProperties = { minWidth: 80 };

  const borderClass = selected ? 'border-blue-400 shadow-md' : 'border-slate-200 hover:border-slate-300';

  if (shape === 'rectangle') {
    rootClasses += 'border-2 shadow-sm rounded-none ' + borderClass;
    rootStyle.backgroundColor = bgColor;
  } else if (shape === 'circle') {
    rootClasses += 'flex items-center justify-center';
    rootStyle = { width: 80, height: 80 };
  } else if (shape === 'diamond') {
    rootClasses += 'flex items-center justify-center';
    rootStyle = { width: 90, height: 90 };
  } else {
    // rounded
    rootClasses += 'border-2 shadow-sm rounded-xl ' + borderClass;
    rootStyle.backgroundColor = bgColor;
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={rootClasses}
      style={rootStyle}
    >
      {/* Connection handles — 4 positions × (source + target), backward-compat order */}
      <Handle type="target" position={Position.Left} id="target-left" className={handleDotStyle} />
      <Handle type="source" position={Position.Right} id="source-right" className={handleDotStyle} />
      <Handle type="target" position={Position.Top} id="target-top" className={handleDotStyle} />
      <Handle type="source" position={Position.Top} id="source-top" className={handleDotStyle} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className={handleDotStyle} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className={handleDotStyle} />
      <Handle type="target" position={Position.Right} id="target-right" className={handleDotStyle} />
      <Handle type="source" position={Position.Left} id="source-left" className={handleDotStyle} />

      {shape === 'diamond' ? (
        <div 
          className={`absolute inset-0 border-2 rounded-sm flex items-center justify-center overflow-hidden ${borderClass}`} 
          style={{ transform: 'rotate(45deg)', backgroundColor: bgColor }} 
        >
          <div style={{ transform: 'rotate(-45deg)' }} className="w-full h-full flex items-center justify-center">
            <NodeEditor
              value={label}
              onChange={handleLabelChange}
              editing={editing}
              onEditingChange={setEditing}
              textColor={textColor}
              bold={bold}
              italic={italic}
              underline={underline}
              readOnly={false}
            />
          </div>
        </div>
      ) : shape === 'circle' ? (
        <div 
          className={`absolute inset-0 border-2 rounded-full flex items-center justify-center overflow-hidden ${borderClass}`} 
          style={{ backgroundColor: bgColor }} 
        >
          <div className="w-full h-full flex items-center justify-center">
            <NodeEditor
              value={label}
              onChange={handleLabelChange}
              editing={editing}
              onEditingChange={setEditing}
              textColor={textColor}
              bold={bold}
              italic={italic}
              underline={underline}
              readOnly={false}
            />
          </div>
        </div>
      ) : (
        <NodeEditor
          value={label}
          onChange={handleLabelChange}
          editing={editing}
          onEditingChange={setEditing}
          textColor={textColor}
          bold={bold}
          italic={italic}
          underline={underline}
          readOnly={false}
        />
      )}

      {/* Mini toolbar — above node, on select (not editing) */}
      {showMiniToolbar && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 flex items-center gap-1 px-2 py-1.5 bg-white rounded-lg shadow-md border border-slate-200 z-10"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={handleDeleteThis} className="p-1.5 rounded hover:bg-red-50 hover:text-red-600 transition-colors text-slate-500" title="Delete node">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={handleDuplicate} className="p-1.5 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors text-slate-500" title="Duplicate node (Ctrl+D)">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
          {[
            { id: 'rectangle', icon: '□' },
            { id: 'rounded', icon: '▢' },
            { id: 'circle', icon: '○' },
            { id: 'diamond', icon: '◇' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); handleShapeChange(s.id); }}
              className={[
                'w-5 h-5 flex items-center justify-center rounded transition-transform hover:scale-110',
                s.id === shape ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-400' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
              ].join(' ')}
              title={`Shape: ${s.id}`}
            >
              {s.icon}
            </button>
          ))}
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={(e) => { e.stopPropagation(); handleColorChange(c); }}
              className={[
                'w-4 h-4 rounded-full border transition-transform hover:scale-125',
                c === bgColor ? 'border-blue-500 ring-1 ring-blue-400' : 'border-slate-300',
              ].join(' ')}
              style={{ backgroundColor: c }}
              aria-label={`Set node color to ${c}`}
            />
          ))}
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={(e) => { e.stopPropagation(); handleTextColorChange(c); }}
              className={[
                'w-4 h-4 rounded-full border transition-transform hover:scale-125',
                c === textColor ? 'border-blue-500 ring-1 ring-blue-400' : 'border-slate-300',
              ].join(' ')}
              style={{ backgroundColor: c }}
              aria-label={`Set text color to ${c}`}
              title="Text color"
            />
          ))}
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
          {([
            ['bold', 'B'],
            ['italic', 'I'],
            ['underline', 'U'],
          ] as const).map(([style, label]) => (
            <button
              key={style}
              type="button"
              onClick={(e) => { e.stopPropagation(); handleTextStyleToggle(style); }}
              className={[
                'w-5 h-5 flex items-center justify-center rounded text-xs transition-colors',
                data[style] === true ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-400' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                style === 'bold' ? 'font-bold' : '',
                style === 'italic' ? 'italic' : '',
                style === 'underline' ? 'underline' : '',
              ].join(' ')}
              title={`Toggle ${style}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Quick-add "+" buttons — 4 directions, on hover/select */}
      {showControls && (
        <>
          <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => handleQuickAddDir(e, 'right')} className="absolute right-[-22px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center hover:bg-blue-600 transition-colors z-10" title="Add node right">+</button>
          <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => handleQuickAddDir(e, 'left')} className="absolute left-[-22px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center hover:bg-blue-600 transition-colors z-10" title="Add node left">+</button>
          <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => handleQuickAddDir(e, 'bottom')} className="absolute bottom-[-22px] left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center hover:bg-blue-600 transition-colors z-10" title="Add node below">+</button>
          <button type="button" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => handleQuickAddDir(e, 'top')} className="absolute top-[-22px] left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center hover:bg-blue-600 transition-colors z-10" title="Add node above">+</button>
        </>
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
  const textColor = typeof data.textColor === 'string' ? data.textColor : '#1e293b';
  const bold = data.bold === true;
  const italic = data.italic === true;
  const underline = data.underline === true;
  const shape = typeof data.shape === 'string' ? data.shape : 'rounded';
  const searchMatch = data._searchMatch as boolean | undefined;
  const searchDimmed = data._searchDimmed as boolean | undefined;

  let rootClasses = 'transition-shadow cursor-default relative ';
  if (searchMatch) rootClasses += 'ring-2 ring-blue-500 z-50 ';
  if (searchDimmed) rootClasses += 'opacity-30 ';
  let rootStyle: React.CSSProperties = { minWidth: 80 };

  const borderClass = 'border-slate-200';

  if (shape === 'rectangle') {
    rootClasses += 'border-2 shadow-sm rounded-none ' + borderClass;
    rootStyle.backgroundColor = bgColor;
  } else if (shape === 'circle') {
    rootClasses += 'flex items-center justify-center';
    rootStyle = { width: 80, height: 80 };
  } else if (shape === 'diamond') {
    rootClasses += 'flex items-center justify-center';
    rootStyle = { width: 90, height: 90 };
  } else {
    // rounded
    rootClasses += 'border-2 shadow-sm rounded-xl ' + borderClass;
    rootStyle.backgroundColor = bgColor;
  }

  const hiddenHandle = '!w-0 !h-0 !bg-transparent !border-0 !min-w-0 !min-h-0';

  return (
    <div className={rootClasses} style={rootStyle}>
      <Handle type="target" position={Position.Left} id="target-left" className={hiddenHandle} />
      <Handle type="source" position={Position.Right} id="source-right" className={hiddenHandle} />
      <Handle type="target" position={Position.Top} id="target-top" className={hiddenHandle} />
      <Handle type="source" position={Position.Top} id="source-top" className={hiddenHandle} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className={hiddenHandle} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className={hiddenHandle} />
      <Handle type="target" position={Position.Right} id="target-right" className={hiddenHandle} />
      <Handle type="source" position={Position.Left} id="source-left" className={hiddenHandle} />

      {shape === 'diamond' ? (
        <div 
          className={`absolute inset-0 border-2 rounded-sm flex items-center justify-center overflow-hidden ${borderClass}`} 
          style={{ transform: 'rotate(45deg)', backgroundColor: bgColor }} 
        >
          <div style={{ transform: 'rotate(-45deg)' }} className="w-full h-full flex items-center justify-center">
            <NodeEditor value={label} textColor={textColor} bold={bold} italic={italic} underline={underline} readOnly />
          </div>
        </div>
      ) : shape === 'circle' ? (
        <div 
          className={`absolute inset-0 border-2 rounded-full flex items-center justify-center overflow-hidden ${borderClass}`} 
          style={{ backgroundColor: bgColor }} 
        >
          <div className="w-full h-full flex items-center justify-center">
            <NodeEditor value={label} textColor={textColor} bold={bold} italic={italic} underline={underline} readOnly />
          </div>
        </div>
      ) : (
        <NodeEditor value={label} textColor={textColor} bold={bold} italic={italic} underline={underline} readOnly />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom edge — editable (owner / editor)
// ---------------------------------------------------------------------------

function MindMapEdgeEditable(props: EdgeProps<MindMapEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data, style, markerEnd, label } = props;
  const { setEdges } = useReactFlow();
  const pushSnapshot = useContext(UndoRedoContext);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  const strokeStyle = data?.strokeStyle as string | undefined;
  const currentLabel = (data?.label as string) || (label as string) || '';
  const [localLabel, setLocalLabel] = useState(currentLabel);

  useEffect(() => {
    setLocalLabel(currentLabel);
  }, [currentLabel]);

  let strokeDasharray = undefined;
  if (strokeStyle === 'dashed') strokeDasharray = '6 3';
  if (strokeStyle === 'dotted') strokeDasharray = '2 4';

  const edgeStyle = { ...style, strokeDasharray };

  const saveLabel = () => {
    if (localLabel === currentLabel) return;
    pushSnapshot?.();
    setEdges((eds) => eds.map(e => {
      if (e.id === id) {
        return { ...e, label: localLabel, data: { ...e.data, label: localLabel } };
      }
      return e;
    }));
  };

  const setEdgeStyle = (newStyle: string) => {
    if (strokeStyle === newStyle) return;
    pushSnapshot?.();
    setEdges((eds) => eds.map(e => {
      if (e.id === id) {
        return { ...e, data: { ...e.data, strokeStyle: newStyle } };
      }
      return e;
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setLocalLabel(currentLabel);
      e.currentTarget.blur();
    }
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={edgeStyle} markerEnd={markerEnd} interactionWidth={20} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: selected ? 10 : 1,
          }}
          className="flex flex-col items-center gap-1.5"
        >
          {selected && (
            <div
              className="flex bg-white shadow-md border border-slate-200 rounded-md p-0.5 gap-0.5"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button onClick={() => setEdgeStyle('solid')} className={`px-2 py-0.5 text-xs font-bold rounded ${!strokeStyle || strokeStyle === 'solid' ? 'bg-slate-100 text-blue-600' : 'hover:bg-slate-50 text-slate-500'}`} title="Solid">—</button>
              <button onClick={() => setEdgeStyle('dashed')} className={`px-2 py-0.5 text-xs font-bold rounded ${strokeStyle === 'dashed' ? 'bg-slate-100 text-blue-600' : 'hover:bg-slate-50 text-slate-500'}`} title="Dashed">- -</button>
              <button onClick={() => setEdgeStyle('dotted')} className={`px-2 py-0.5 text-xs font-bold rounded ${strokeStyle === 'dotted' ? 'bg-slate-100 text-blue-600' : 'hover:bg-slate-50 text-slate-500'}`} title="Dotted">···</button>
            </div>
          )}

          {selected ? (
            <input
              placeholder="Edge label..."
              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-center shadow-sm outline-none focus:ring-1 focus:ring-blue-400"
              style={{ width: Math.max(80, localLabel.length * 8 + 16) }}
              value={localLabel}
              onChange={(e) => setLocalLabel(e.target.value)}
              onBlur={saveLabel}
              onKeyDown={handleKeyDown}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : localLabel ? (
            <div className="bg-white/90 px-1.5 py-0.5 rounded text-xs font-medium text-slate-600 shadow-sm border border-slate-100/50">
              {localLabel}
            </div>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Custom edge — read-only (viewer)
// ---------------------------------------------------------------------------

function MindMapEdgeReadOnly(props: EdgeProps<MindMapEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style, markerEnd, label } = props;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  const strokeStyle = data?.strokeStyle as string | undefined;
  const currentLabel = (data?.label as string) || (label as string) || '';

  let strokeDasharray = undefined;
  if (strokeStyle === 'dashed') strokeDasharray = '6 3';
  if (strokeStyle === 'dotted') strokeDasharray = '2 4';

  const edgeStyle = { ...style, strokeDasharray };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={edgeStyle} markerEnd={markerEnd} />
      {currentLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="flex flex-col items-center gap-1.5"
          >
            <div className="bg-white/90 px-1.5 py-0.5 rounded text-xs font-medium text-slate-600 shadow-sm border border-slate-100/50">
              {currentLabel}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

  // ---------------------------------------------------------------------------
  // Inner canvas component (must be inside ReactFlowProvider)
  // ---------------------------------------------------------------------------

interface CanvasInnerProps {
  mapId: string;
  tokenColumn: 'owner_token' | 'edit_token' | 'view_token' | null;
  token: string | null;
  accessRole: AccessRole;
  guestMode?: boolean;
  }

  function CanvasInner({ mapId, tokenColumn, token, accessRole, guestMode = false }: CanvasInnerProps) {
  const router = useRouter();

  const [role, setRole] = useState<AccessRole>(accessRole);
  const [activeToken, setActiveToken] = useState<string | null>(token);
  const [activeColumn, setActiveColumn] = useState<'owner_token' | 'edit_token' | 'view_token' | null>(tokenColumn);

  useEffect(() => {
    setRole(accessRole);
    setActiveToken(token);
    setActiveColumn(tokenColumn);
  }, [accessRole, token, tokenColumn]);

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

  const canEdit = guestMode || role === 'owner' || role === 'editor';
  const readOnly = !canEdit;

  const [isPresentationMode, setIsPresentationMode] = useState(false);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Comment panel state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentMode, setCommentMode] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [commentHint, setCommentHint] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Get session user name for comments
  useEffect(() => {
    getSession().then((s) => {
      if (s?.user?.user_metadata?.full_name) {
        setAuthorName(s.user.user_metadata.full_name);
      }
    });
  }, []);
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (!guestMode) return;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
    };
  }, [guestMode]);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchTerm('');
    if (flowWrapperRef.current) {
      flowWrapperRef.current.focus();
    }
  }, []);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!searchTerm) return;
      const lower = searchTerm.toLowerCase();
      const firstMatch = nodes.find(n => (typeof n.data.label === 'string') && n.data.label.toLowerCase().includes(lower));
      if (firstMatch) {
        fitView({ nodes: [{ id: firstMatch.id }], padding: 0.5, duration: 400 });
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    }
    e.stopPropagation();
  }

  const displayNodes = useMemo(() => {
    if (!isSearchOpen || !searchTerm) return nodes;
    const lower = searchTerm.toLowerCase();
    return nodes.map((n) => {
      const match = (typeof n.data.label === 'string') && n.data.label.toLowerCase().includes(lower);
      return {
        ...n,
        data: {
          ...n.data,
          _searchMatch: match,
          _searchDimmed: !match,
        }
      };
    });
  }, [nodes, isSearchOpen, searchTerm]);

  const isCanvasReadOnly = !canEdit || isPresentationMode;

  const nodeTypes: NodeTypes = useMemo(() => ({
    mindmap: isCanvasReadOnly ? MindMapNodeReadOnly : MindMapNodeEditable,
  }), [isCanvasReadOnly]);

  const edgeTypes: EdgeTypes = useMemo(() => ({
    smoothstep: isCanvasReadOnly ? MindMapEdgeReadOnly : MindMapEdgeEditable,
  }), [isCanvasReadOnly]);

  // -------------------------------------------------------------------------
  // Load map data on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    async function loadMap() {
      setLoading(true);
      setError(null);

      try {
        if (guestMode) {
          setTitle('Guest Mindmap');
          setNodes([
            {
              id: 'node-root',
              type: 'mindmap',
              position: { x: 0, y: 0 },
              data: { label: 'Start here', color: '#fef08a' },
            },
          ]);
          setEdges([]);
          return;
        }

        let resolvedColumn = tokenColumn;
        let resolvedToken = token;
        let resolvedRole = accessRole;

        if (!resolvedToken && typeof window !== 'undefined') {
          const storedToken = localStorage.getItem(`mindmap_owned_${mapId}`);
          if (storedToken) {
            resolvedColumn = 'owner_token';
            resolvedToken = storedToken;
            resolvedRole = 'owner';
          }
        }

        setActiveColumn(resolvedColumn);
        setActiveToken(resolvedToken);
        setRole(resolvedRole);

        const client = resolvedToken ? createTokenClient(resolvedToken) : supabase;

        let query = client
          .from('mindmaps')
          .select('*')
          .eq('id', mapId);

        if (resolvedColumn && resolvedToken) {
          query = query.eq(resolvedColumn, resolvedToken);
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
        const migratedEdges = rawEdges.map((e) => ({
          ...e,
          sourceHandle: e.sourceHandle ?? 'source-right',
          targetHandle: e.targetHandle ?? 'target-left',
        }));

        setNodes(rawNodes);
        setEdges(migratedEdges);

        if (data.title) setTitle(data.title as string);

        if (resolvedRole === 'owner') {
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
  }, [mapId, guestMode]);

  // -------------------------------------------------------------------------
  // Auto-fit on initial load — once only, with smooth animation
  // -------------------------------------------------------------------------
  const hasFittedView = useRef(false);
  const lastSavedPayloadRef = useRef<string>('');

  useEffect(() => {
    if (!loading && !error && nodes.length > 0 && !hasFittedView.current) {
      hasFittedView.current = true;
      requestAnimationFrame(() => {
        fitView({ padding: 0.2, duration: 400 });
      });
    }
  }, [loading, error, nodes.length, fitView]);

  const persistSave = useCallback(
    async (nodesToSave: MindMapNode[], edgesToSave: MindMapEdge[]) => {
      if (guestMode) return;

      setSaveStatus('saving');
      try {
        const client = activeToken ? createTokenClient(activeToken) : supabase;
        let query = client
          .from('mindmaps')
          .update({
            nodes: nodesToSave,
            edges: edgesToSave,
            updated_at: new Date().toISOString(),
          })
          .eq('id', mapId);

        if (activeColumn && activeToken) {
          query = query.eq(activeColumn, activeToken);
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
    [mapId, activeColumn, activeToken, guestMode]
  );

  const debouncedSave = useDebounce(persistSave, 1500);

  const onNodesChange: OnNodesChange<MindMapNode> = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    []
  );

  const onEdgesChange: OnEdgesChange<MindMapEdge> = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    []
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (connection.source === connection.target) return;
      pushSnapshot();
      setEdges((eds) => addEdge({ ...connection, type: 'smoothstep' }, eds));
    },
    [pushSnapshot]
  );

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (canEdit && !loading) {
      const payload = JSON.stringify({
        nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
        edges: edges.map(({ id, source, target, sourceHandle, targetHandle, type, data, label }) => ({
          id, source, target, sourceHandle, targetHandle, type, data, label,
        })),
      });

      if (payload !== lastSavedPayloadRef.current) {
        lastSavedPayloadRef.current = payload;
        debouncedSave(nodes, edges);
      }
    }
  }, [nodes, edges, canEdit, loading, debouncedSave]);

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    return connection.source !== connection.target;
  }, []);

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

    setNodes((nds) => [...nds, newNode]);
  }

  function handleCanvasDoubleClick(e: React.MouseEvent) {
    if (!canEdit) return;
    const target = e.target as (HTMLElement | SVGElement | null);
    if (!target) return;
    if (
      target.closest?.('.react-flow__node') ||
      target.closest?.('.react-flow__edge') ||
      target.closest?.('.react-flow__controls') ||
      target.closest?.('.react-flow__minimap')
    ) {
      return;
    }

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    pushSnapshot();

    const newNode: MindMapNode = {
      id: `node-${Date.now()}`,
      type: 'mindmap',
      position,
      data: { label: 'New Node', _autoEdit: true },
    };

    setNodes((nds) => [...nds, newNode]);
  }

  // -------------------------------------------------------------------------
  // Quick-add — "+" button on node creates child node + edge
  // -------------------------------------------------------------------------
  const handleQuickAdd = useCallback(
    (sourceId: string, direction: QuickAddDirection) => {
      pushSnapshot();
      const newId = `node-${Date.now()}`;
      const offsets = DIRECTION_OFFSETS[direction];

      setNodes((nds) => {
        const sourceNode = nds.find((n) => n.id === sourceId);
        if (!sourceNode) return nds;

        const newNode: MindMapNode = {
          id: newId,
          type: 'mindmap',
          position: {
            x: sourceNode.position.x + offsets.x,
            y: sourceNode.position.y + offsets.y,
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
          sourceHandle: offsets.sourceHandle,
          target: newId,
          targetHandle: offsets.targetHandle,
          type: 'smoothstep',
        },
      ]);
    },
    [pushSnapshot]
  );

  function handleDeleteSelected() {
    pushSnapshot();
    const selectedNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    setNodes((nds) => nds.filter((n) => !n.selected));
    setEdges((eds) => eds.filter((e) => !e.selected && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)));
  }

  // -------------------------------------------------------------------------
  // Delete map (owner only) — called from SharePanel
  // -------------------------------------------------------------------------
  async function handleDeleteMap() {
    if (role !== 'owner' || !activeToken) return;

    try {
      const client = createTokenClient(activeToken);
      const { error: deleteError } = await client
        .from('mindmaps')
        .delete()
        .eq('id', mapId)
        .eq('owner_token', activeToken);

      if (deleteError) {
        console.error('Delete failed:', deleteError);
        return;
      }

      if (typeof window !== 'undefined') {
        localStorage.removeItem(`mindmap_owned_${mapId}`);
        localStorage.removeItem(`mindmap_thumb_${mapId}`);
      }

      router.push('/dashboard');
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

    // --- Escape: close search, exit presentation, or deselect all ---
    if (e.key === 'Escape') {
      e.preventDefault();
      if (isSearchOpen) {
        closeSearch();
      } else if (isPresentationMode) {
        setIsPresentationMode(false);
      } else {
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
        setEdges((eds) => eds.map((ed) => ({ ...ed, selected: false })));
      }
      return;
    }

    // --- Search: Ctrl+F ---
    if (e.key.toLowerCase() === 'f' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setIsSearchOpen(true);
      return;
    }

    if (isTextInput) return;

    // --- Presentation Mode: Ctrl+Shift+P ---
    if (e.key.toLowerCase() === 'p' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault();
      setIsPresentationMode((prev) => !prev);
      return;
    }

    if (!canEdit) return;

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
        data: { ...n.data, _autoEdit: undefined },
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
          data: { ...source.data, _autoEdit: undefined },
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
          sourceHandle: 'source-right',
          target: childId,
          targetHandle: 'target-left',
          type: 'smoothstep',
        },
      ]);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      pushSnapshot();
      const siblingId = `node-${Date.now()}`;
      const parentEdge = edges.find((ed) => ed.target === selectedNode.id);

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

      if (parentEdge) {
        setEdges((eds) => [
          ...eds,
          {
            id: `edge-${parentEdge.source}-${siblingId}`,
            source: parentEdge.source,
            sourceHandle: parentEdge.sourceHandle || 'source-right',
            target: siblingId,
            targetHandle: parentEdge.targetHandle || 'target-left',
            type: 'smoothstep',
          },
        ]);
      } else {
        setEdges((eds) => [
          ...eds,
          {
            id: `edge-${selectedNode.id}-${siblingId}`,
            source: selectedNode.id,
            sourceHandle: 'source-bottom',
            target: siblingId,
            targetHandle: 'target-top',
            type: 'smoothstep',
          },
        ]);
      }
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
      {isSearchOpen && (
        <div 
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-white rounded-xl shadow-xl border border-slate-200 px-4 py-2 flex items-center gap-2"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-48 text-sm outline-none text-slate-800"
          />
          <button 
            type="button"
            onClick={closeSearch}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
            aria-label="Close search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {!isPresentationMode && (
        <MapTitle
          mapId={mapId}
          initialTitle={title}
          canRename={role === 'owner' && !guestMode}
          ownerToken={role === 'owner' ? activeToken : null}
        />
      )}

      {guestMode && !isPresentationMode && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
          Guest Mode is temporary. This map is not saved, cannot be shared, and will be lost when you refresh or leave this page.
        </div>
      )}

      {!isPresentationMode && (
        <Toolbar
          canEdit={canEdit}
          isOwner={role === 'owner' && !guestMode}
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
          isPresentationMode={isPresentationMode}
          onTogglePresentation={() => setIsPresentationMode((p) => !p)}
          commentsEnabled={!guestMode}
          commentMode={commentMode}
          onToggleCommentMode={() => {
            setCommentMode((prev) => {
              const next = !prev;
              if (next) {
                const selNode = selectedNodeId;
                if (selNode) {
                  setShowComments(true);
                } else {
                  setCommentHint(true);
                  if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
                  hintTimerRef.current = setTimeout(() => setCommentHint(false), 3000);
                }
              } else {
                setShowComments(false);
                setCommentHint(false);
              }
              return next;
            });
          }}
        />
      )}

      {isPresentationMode && (
        <button
          onClick={() => setIsPresentationMode(false)}
          className="fixed top-4 right-4 z-50 bg-mindmap-accent text-white rounded-lg px-3 py-2 text-sm shadow-md hover:bg-mindmap-accent/90 transition-colors inline-flex items-center gap-1.5"
        >
          <span>Exit Presentation</span>
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex-1 relative bg-white" ref={flowWrapperRef} onDoubleClick={handleCanvasDoubleClick}>
        <ReactFlow<MindMapNode, MindMapEdge>
          style={{ backgroundColor: '#ffffff' }}
          nodes={displayNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={commentMode ? (_, node) => { setSelectedNodeId(node.id); setShowComments(true); } : undefined}
          onConnect={canEdit ? onConnect : undefined}
          onNodeDragStart={canEdit ? () => pushSnapshot() : undefined}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={!isCanvasReadOnly}
          nodesConnectable={!isCanvasReadOnly}
          elementsSelectable={!isCanvasReadOnly}
          zoomOnScroll
          panOnDrag
          defaultEdgeOptions={{ type: 'smoothstep' }}
          deleteKeyCode={null}
          isValidConnection={isValidConnection}
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
            data-export-ignore="true"
            className={[
              'absolute bottom-4 right-4 z-10 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm inline-flex items-center gap-1.5',
              saveStatus === 'saving' ? 'bg-slate-100 text-slate-500' : '',
              saveStatus === 'saved' ? 'bg-green-50 text-green-600 border border-green-200' : '',
              saveStatus === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : '',
            ].join(' ')}
          >
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                <span>Saving…</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <Check className="w-3.5 h-3.5 text-green-600" />
                <span>Saved</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                <span>Save failed</span>
              </>
            )}
          </div>
        )}

        <div data-export-ignore="true" className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-white/90 border border-slate-200 text-xs font-medium text-slate-600 backdrop-blur-sm pointer-events-none inline-flex items-center gap-1.5 shadow-sm">
          {guestMode && (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Guest Mode</span>
            </>
          )}
          {!guestMode && role === 'owner' && (
            <>
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>Owner</span>
            </>
          )}
          {!guestMode && role === 'editor' && (
            <>
              <Pencil className="w-3.5 h-3.5 text-blue-500" />
              <span>Editor</span>
            </>
          )}
          {!guestMode && role === 'viewer' && (
            <>
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>View only</span>
            </>
          )}
        </div>
      </div>

      {/* Share panel — owner only */}
      {showSharePanel && role === 'owner' && !guestMode && !isPresentationMode && (
        <SharePanel
          mapId={mapId}
          viewToken={viewToken}
          editToken={editToken}
          ownerToken={ownerToken || activeToken || ''}
          onClose={() => setShowSharePanel(false)}
          onDelete={handleDeleteMap}
        />
      )}

      {/* Comment panel */}
      {showComments && selectedNodeId && activeToken && (
        <CommentPanel
          nodeId={selectedNodeId}
          mapId={mapId}
          token={activeToken}
          role={role}
          onClose={() => { setShowComments(false); setSelectedNodeId(null); }}
          authorName={authorName}
        />
      )}

      {/* Comment mode hint */}
      {commentHint && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-lg text-sm animate-pulse">
          Click any node to view comments
        </div>
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
  accessRole: AccessRole;
  guestMode?: boolean;
}

export default function MindMapCanvas(props: MindMapCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
