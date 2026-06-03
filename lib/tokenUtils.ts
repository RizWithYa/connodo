/**
 * tokenUtils.ts
 *
 * Resolves which access role the current user has for a given map.
 *
 * Token priority (per spec):
 *   owner_token  → role: 'owner'  (full edit + rename + delete)
 *   edit_token   → role: 'editor' (edit canvas only)
 *   view_token   → role: 'viewer' (read-only)
 *   none         → role: 'viewer' (fallback — still read-only)
 *
 * Owner token is ALSO persisted in localStorage under key `connodo_owned_[id]`
 * so the owner can return to their map without keeping the URL.
 */

export type AccessRole = 'owner' | 'editor' | 'viewer';

export interface TokenInfo {
  role: AccessRole;
  /** The active token value (used when making Supabase queries) */
  token: string | null;
  /** The column name to use in Supabase `.eq()` filter */
  tokenColumn: 'owner_token' | 'edit_token' | 'view_token' | null;
}

/**
 * Resolve access role from URL search params.
 *
 * Usage (in a Next.js page component):
 *   const tokenInfo = resolveTokenFromParams(searchParams, mapId);
 */
export function resolveTokenFromParams(
  searchParams: Record<string, string | string[] | undefined>,
  mapId: string
): TokenInfo {
  const owner = firstString(searchParams['owner']);
  const edit = firstString(searchParams['edit']);
  const view = firstString(searchParams['view']);

  if (owner) {
    // Persist owner token in localStorage so the owner can return later
    if (typeof window !== 'undefined') {
      localStorage.setItem(`connodo_owned_${mapId}`, owner);
    }
    return { role: 'owner', token: owner, tokenColumn: 'owner_token' };
  }

  if (edit) {
    return { role: 'editor', token: edit, tokenColumn: 'edit_token' };
  }

  if (view) {
    return { role: 'viewer', token: view, tokenColumn: 'view_token' };
  }

  // No token in URL — check localStorage for a stored owner token
  if (typeof window !== 'undefined') {
    const storedOwner = localStorage.getItem(`connodo_owned_${mapId}`);
    if (storedOwner) {
      return { role: 'owner', token: storedOwner, tokenColumn: 'owner_token' };
    }
  }

  // Completely anonymous — read-only fallback
  return { role: 'viewer', token: null, tokenColumn: null };
}

/** Helper to extract first string value from Next.js searchParam (can be string | string[]) */
function firstString(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Build the share URLs for the share panel.
 */
export function buildShareLinks(
  mapId: string,
  viewToken: string,
  editToken: string,
  ownerToken: string
): { viewUrl: string; editUrl: string; ownerUrl: string } {
  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? '';

  return {
    viewUrl:  `${base}/map/${mapId}?view=${viewToken}`,
    editUrl:  `${base}/map/${mapId}?edit=${editToken}`,
    ownerUrl: `${base}/map/${mapId}?owner=${ownerToken}`,
  };
}
