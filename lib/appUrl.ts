function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

function normalizeUrl(url: string | undefined | null) {
  if (!url) return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  return trimTrailingSlash(trimmed);
}

function envBaseUrl() {
  const explicitUrl =
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeUrl(process.env.APP_URL);

  if (explicitUrl) return explicitUrl;

  const vercelUrl = normalizeUrl(process.env.VERCEL_URL);
  if (vercelUrl) {
    return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
  }

  return null;
}

export function getClientBaseUrl() {
  if (typeof window !== 'undefined') {
    return trimTrailingSlash(window.location.origin);
  }

  return envBaseUrl() ?? 'http://localhost:3000';
}

export function getRequestBaseUrl(request: {
  headers: Headers;
  nextUrl?: { origin?: string };
}) {
  const origin = normalizeUrl(request.headers.get('origin'));
  if (origin) return origin;

  const forwardedHost = normalizeUrl(request.headers.get('x-forwarded-host'));
  if (forwardedHost) {
    const forwardedProto =
      normalizeUrl(request.headers.get('x-forwarded-proto')) ?? 'https';
    return `${forwardedProto}://${forwardedHost}`;
  }

  const requestOrigin = normalizeUrl(request.nextUrl?.origin);
  if (requestOrigin) return requestOrigin;

  return envBaseUrl() ?? 'http://localhost:3000';
}
