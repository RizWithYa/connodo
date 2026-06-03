import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Creates a Supabase client with the custom x-mindmap-token header
 * used to securely pass token verifications to Postgres RLS.
 */
export function createTokenClient(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        'x-mindmap-token': token,
      },
    },
  });
}
// ---------------------------------------------------------------------------
// Types matching the `mindmaps` table schema
// ---------------------------------------------------------------------------

export interface MindMap {
  id: string;
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  view_token: string;
  edit_token: string;
  owner_token: string;
  updated_at: string;
}

// Minimal React Flow node/edge shapes stored as JSONB
export interface FlowNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: { label: string };
  [key: string]: unknown;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export async function getSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ?? null;
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: process.env.NEXT_PUBLIC_SITE_URL + '/auth/callback',
    },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}
