import { createClient } from '@supabase/supabase-js';

export interface Comment {
  id: string;
  map_id: string;
  node_id: string;
  text: string;
  author: string;
  created_at: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function fetchComments(token: string, mapId: string, nodeId: string): Promise<Comment[]> {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { 'x-connodo-token': token } }
  });
  const { data } = await client
    .from('node_comments')
    .select('*')
    .eq('map_id', mapId)
    .eq('node_id', nodeId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function addComment(token: string, mapId: string, nodeId: string, text: string, author: string): Promise<Comment | null> {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { 'x-connodo-token': token } }
  });
  const { data } = await client
    .from('node_comments')
    .insert({ map_id: mapId, node_id: nodeId, text, author })
    .select('*')
    .single();
  return data ?? null;
}

export async function deleteComment(token: string, commentId: string): Promise<void> {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { 'x-connodo-token': token } }
  });
  await client.from('node_comments').delete().eq('id', commentId);
}

export async function fetchMapComments(token: string, mapId: string): Promise<Comment[]> {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { 'x-connodo-token': token } }
  });
  const { data } = await client
    .from('node_comments')
    .select('*')
    .eq('map_id', mapId);
  return data ?? [];
}
