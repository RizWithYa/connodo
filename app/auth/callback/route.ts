import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/?auth_error=' + encodeURIComponent(error), request.url));
  }

  if (code) {
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError && data?.session) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      let storageKey = 'supabase.auth.token';
      try {
        const ref = new URL(supabaseUrl).hostname.split('.')[0];
        storageKey = `sb-${ref}-auth-token`;
      } catch {
        storageKey = 'supabase.auth.token';
      }

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authenticating...</title>
</head>
<body style="background:#0b1120;color:#94a3b8;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <p>Authenticating, please wait...</p>
  <script>
    try {
      const session = ${JSON.stringify(data.session)};
      const key = ${JSON.stringify(storageKey)};
      if (session && key) {
        localStorage.setItem(key, JSON.stringify(session));
      }
    } catch (e) {
      console.error(e);
    }
    window.location.replace('/dashboard');
  </script>
</body>
</html>`;

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  }

  return NextResponse.redirect(new URL('/dashboard', request.url));
}
