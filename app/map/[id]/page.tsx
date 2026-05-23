import MindMapCanvas from '@/components/MindMapCanvas';
import type { AccessRole } from '@/lib/tokenUtils';

/**
 * /map/[id] — Canvas page.
 *
 * This is a Server Component. It reads searchParams (owner/edit/view token)
 * and passes the resolved token info down to the client-side MindMapCanvas.
 *
 * Token resolution happens here (server-side) so the canvas gets the correct
 * role immediately without a client-side localStorage read on first paint.
 * localStorage check (returning owner) is handled inside MindMapCanvas on mount.
 */
export default function MapPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { owner?: string; edit?: string; view?: string };
}) {
  const mapId = params.id;

  // Resolve role + token from URL params (server-side — no localStorage here)
  let role: AccessRole = 'viewer';
  let token: string | null = null;
  let tokenColumn: 'owner_token' | 'edit_token' | 'view_token' | null = null;

  if (searchParams.owner) {
    role = 'owner';
    token = searchParams.owner;
    tokenColumn = 'owner_token';
  } else if (searchParams.edit) {
    role = 'editor';
    token = searchParams.edit;
    tokenColumn = 'edit_token';
  } else if (searchParams.view) {
    role = 'viewer';
    token = searchParams.view;
    tokenColumn = 'view_token';
  }
  // If no token in URL, MindMapCanvas will check localStorage on mount
  // and upgrade to 'owner' if a stored token is found.

  return (
    <main className="w-screen h-screen overflow-hidden bg-slate-50">
      <MindMapCanvas
        mapId={mapId}
        role={role}
        token={token}
        tokenColumn={tokenColumn}
      />
    </main>
  );
}
