import { FlowNode, FlowEdge } from './supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TemplateNode = FlowNode & { data: { label: string; shape?: string; color?: string } };
type TemplateEdge = FlowEdge & { sourceHandle?: string; targetHandle?: string };

export interface TemplateData {
  label: string;
  description: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

export const TEMPLATES: Record<string, TemplateData> = {
  brainstorm: {
    label: 'Brainstorm',
    description: 'Central topic with radial ideas in all four directions',
    nodes: [
      {
        id: 'center',
        type: 'connodo',
        position: { x: 0, y: 0 },
        data: { label: 'Brainstorming', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'right',
        type: 'connodo',
        position: { x: 250, y: 0 },
        data: { label: 'Idea 1', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'left',
        type: 'connodo',
        position: { x: -250, y: 0 },
        data: { label: 'Idea 2', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'bottom',
        type: 'connodo',
        position: { x: 0, y: 250 },
        data: { label: 'Idea 3', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'top',
        type: 'connodo',
        position: { x: 0, y: -250 },
        data: { label: 'Idea 4', shape: 'rounded', color: '#4B5694' },
      },
    ],
    edges: [
      {
        id: 'e-center-right',
        source: 'center',
        target: 'right',
        type: 'smoothstep',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
      },
      {
        id: 'e-center-left',
        source: 'center',
        target: 'left',
        type: 'smoothstep',
        sourceHandle: 'source-left',
        targetHandle: 'target-right',
      },
      {
        id: 'e-center-bottom',
        source: 'center',
        target: 'bottom',
        type: 'smoothstep',
        sourceHandle: 'source-bottom',
        targetHandle: 'target-top',
      },
      {
        id: 'e-center-top',
        source: 'center',
        target: 'top',
        type: 'smoothstep',
        sourceHandle: 'source-top',
        targetHandle: 'target-bottom',
      },
    ],
  },
  projectPlan: {
    label: 'Project Plan',
    description: 'Sequential horizontal timeline from planning to launch',
    nodes: [
      {
        id: 'center',
        type: 'connodo',
        position: { x: 0, y: 0 },
        data: { label: 'Project', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'planning',
        type: 'connodo',
        position: { x: 250, y: 0 },
        data: { label: 'Planning', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'execution',
        type: 'connodo',
        position: { x: 500, y: 0 },
        data: { label: 'Execution', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'review',
        type: 'connodo',
        position: { x: 750, y: 0 },
        data: { label: 'Review', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'launch',
        type: 'connodo',
        position: { x: 1000, y: 0 },
        data: { label: 'Launch', shape: 'rounded', color: '#4B5694' },
      },
    ],
    edges: [
      {
        id: 'e-project-planning',
        source: 'center',
        target: 'planning',
        type: 'smoothstep',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
      },
      {
        id: 'e-planning-execution',
        source: 'planning',
        target: 'execution',
        type: 'smoothstep',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
      },
      {
        id: 'e-execution-review',
        source: 'execution',
        target: 'review',
        type: 'smoothstep',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
      },
      {
        id: 'e-review-launch',
        source: 'review',
        target: 'launch',
        type: 'smoothstep',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
      },
    ],
  },
  swot: {
    label: 'SWOT Analysis',
    description: 'Quadrants for Strengths, Weaknesses, Opportunities, Threats',
    nodes: [
      {
        id: 'center',
        type: 'connodo',
        position: { x: 0, y: 0 },
        data: { label: 'SWOT', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'strengths',
        type: 'connodo',
        position: { x: -250, y: -250 },
        data: { label: 'Strengths', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'weaknesses',
        type: 'connodo',
        position: { x: 250, y: -250 },
        data: { label: 'Weaknesses', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'opportunities',
        type: 'connodo',
        position: { x: -250, y: 250 },
        data: { label: 'Opportunities', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'threats',
        type: 'connodo',
        position: { x: 250, y: 250 },
        data: { label: 'Threats', shape: 'rounded', color: '#4B5694' },
      },
    ],
    edges: [
      {
        id: 'e-swot-strengths',
        source: 'center',
        target: 'strengths',
        type: 'smoothstep',
        sourceHandle: 'source-left',
        targetHandle: 'target-right',
      },
      {
        id: 'e-swot-weaknesses',
        source: 'center',
        target: 'weaknesses',
        type: 'smoothstep',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
      },
      {
        id: 'e-swot-opportunities',
        source: 'center',
        target: 'opportunities',
        type: 'smoothstep',
        sourceHandle: 'source-left',
        targetHandle: 'target-right',
      },
      {
        id: 'e-swot-threats',
        source: 'center',
        target: 'threats',
        type: 'smoothstep',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
      },
    ],
  },
  meetingNotes: {
    label: 'Meeting Notes',
    description: 'Agenda, Decisions, and Action Items positioned vertically',
    nodes: [
      {
        id: 'center',
        type: 'connodo',
        position: { x: 0, y: 0 },
        data: { label: 'Meeting', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'agenda',
        type: 'connodo',
        position: { x: 250, y: -250 },
        data: { label: 'Agenda', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'decisions',
        type: 'connodo',
        position: { x: 250, y: 0 },
        data: { label: 'Decisions', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'actionItems',
        type: 'connodo',
        position: { x: 250, y: 250 },
        data: { label: 'Action Items', shape: 'rounded', color: '#4B5694' },
      },
    ],
    edges: [
      {
        id: 'e-meeting-agenda',
        source: 'center',
        target: 'agenda',
        type: 'smoothstep',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
      },
      {
        id: 'e-meeting-decisions',
        source: 'center',
        target: 'decisions',
        type: 'smoothstep',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
      },
      {
        id: 'e-meeting-actionItems',
        source: 'center',
        target: 'actionItems',
        type: 'smoothstep',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
      },
    ],
  },
  learningPath: {
    label: 'Learning Path',
    description: 'Chain of Fundamentals, Advanced, and Mastery',
    nodes: [
      {
        id: 'center',
        type: 'connodo',
        position: { x: 0, y: 0 },
        data: { label: 'Topic', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'fundamentals',
        type: 'connodo',
        position: { x: 250, y: 0 },
        data: { label: 'Fundamentals', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'advanced',
        type: 'connodo',
        position: { x: 500, y: 0 },
        data: { label: 'Advanced', shape: 'rounded', color: '#4B5694' },
      },
      {
        id: 'mastery',
        type: 'connodo',
        position: { x: 750, y: 0 },
        data: { label: 'Mastery', shape: 'rounded', color: '#4B5694' },
      },
    ],
    edges: [
      {
        id: 'e-topic-fundamentals',
        source: 'center',
        target: 'fundamentals',
        type: 'smoothstep',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
      },
      {
        id: 'e-fundamentals-advanced',
        source: 'fundamentals',
        target: 'advanced',
        type: 'smoothstep',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
      },
      {
        id: 'e-advanced-mastery',
        source: 'advanced',
        target: 'mastery',
        type: 'smoothstep',
        sourceHandle: 'source-right',
        targetHandle: 'target-left',
      },
    ],
  },
};
