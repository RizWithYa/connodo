import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const navbarSource = readFileSync(new URL('../components/Navbar.tsx', import.meta.url), 'utf8');
const supabaseSource = readFileSync(new URL('../lib/supabase.ts', import.meta.url), 'utf8');
const googleRouteUrl = new URL('../app/auth/google/route.ts', import.meta.url);
const googleRouteSource = existsSync(googleRouteUrl)
  ? readFileSync(googleRouteUrl, 'utf8')
  : '';

test('supabase exposes email login and register helpers', () => {
  assert.match(
    supabaseSource,
    /export async function signInWithEmail\(email: string, password: string\)/,
    'email login helper should be exported',
  );
  assert.match(
    supabaseSource,
    /supabase\.auth\.signInWithPassword\(\{\s*email,\s*password\s*\}\)/,
    'email login helper should call Supabase signInWithPassword',
  );
  assert.match(
    supabaseSource,
    /export async function signUpWithEmail\(email: string, password: string\)/,
    'email register helper should be exported',
  );
  assert.match(
    supabaseSource,
    /supabase\.auth\.signUp\(\{\s*email,\s*password\s*\}\)/,
    'email register helper should call Supabase signUp',
  );
});

test('google login starts from a backend route with dynamic app URL fallback', () => {
  assert.notEqual(googleRouteSource, '', 'backend Google auth route should exist');
  assert.match(
    googleRouteSource,
    /process\.env\.APP_URL/,
    'backend route should support explicit APP_URL fallback',
  );
  assert.match(
    googleRouteSource,
    /process\.env\.VERCEL_URL/,
    'backend route should support automatic Vercel URL fallback',
  );
  assert.match(
    googleRouteSource,
    /request\.headers\.get\('origin'\)/,
    'backend route should prefer the current request origin',
  );
  assert.match(
    googleRouteSource,
    /redirectTo:\s*new URL\('\/auth\/callback', appUrl\)\.toString\(\)/,
    'backend route should send Supabase back to the same app callback',
  );
});

test('navbar routes Google login through the backend OAuth starter', () => {
  assert.match(
    navbarSource,
    /window\.location\.href = '\/auth\/google';/,
    'Google login button should navigate to the backend OAuth route',
  );
  assert.doesNotMatch(
    navbarSource,
    /signInWithGoogle/,
    'Navbar should not start Google OAuth directly in the browser client',
  );
});

test('navbar includes themed login and register controls', () => {
  assert.match(navbarSource, /type AuthMode = 'login' \| 'register';/, 'navbar should model login/register modes');
  assert.match(navbarSource, /Login/, 'navbar should show a login action');
  assert.match(navbarSource, /Register/, 'navbar should show a register action');
  assert.match(navbarSource, /bg-mindmap-bg-primary/, 'auth UI should use the existing dark theme');
  assert.match(navbarSource, /bg-mindmap-accent/, 'auth primary actions should use the existing accent theme');
  assert.match(navbarSource, /signInWithEmail\(email, password\)/, 'login submit should use email login helper');
  assert.match(navbarSource, /signUpWithEmail\(email, password\)/, 'register submit should use email register helper');
});
