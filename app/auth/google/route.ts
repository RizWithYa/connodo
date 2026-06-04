import { type NextRequest, NextResponse } from 'next/server';
import { getRequestBaseUrl } from '@/lib/appUrl';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const appUrl = getRequestBaseUrl(request);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: new URL('/auth/callback', appUrl).toString(),
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL('/?auth_error=google', appUrl));
  }

  return NextResponse.redirect(data.url);
}
