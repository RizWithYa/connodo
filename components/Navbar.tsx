'use client';

import type { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  onAuthStateChange,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from '@/lib/supabase';

type AuthMode = 'login' | 'register';

interface NavbarProps {
  mode?: 'landing' | 'dashboard';
}

export default function Navbar({ mode = 'dashboard' }: NavbarProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    setAuthMode(null);
    setEmail('');
    setPassword('');
    setAuthLoading(false);
    setAuthMessage(null);
    setAuthError(null);
  }, [session]);

  function openAuthModal(mode: AuthMode) {
    setAuthMode(mode);
    setAuthMessage(null);
    setAuthError(null);
  }

  function closeAuthModal() {
    setAuthMode(null);
    setEmail('');
    setPassword('');
    setAuthLoading(false);
    setAuthMessage(null);
    setAuthError(null);
  }

  function startGoogleLogin() {
    window.location.href = '/auth/google';
  }

  async function handleEmailAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authMode) return;

    setAuthLoading(true);
    setAuthMessage(null);
    setAuthError(null);

    const { error } = authMode === 'login'
      ? await signInWithEmail(email, password)
      : await signUpWithEmail(email, password);

    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
      return;
    }

    if (authMode === 'register') {
      setAuthMessage('Registration successful. Check your email if Supabase requires confirmation.');
      setAuthLoading(false);
      return;
    }

    setAuthLoading(false);
  }

  const userLabel = session?.user.user_metadata.full_name || session?.user.email || 'Account';
  const avatarUrl = session?.user.user_metadata.avatar_url;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 w-full bg-mindmap-bg-primary/90 backdrop-blur-md border-b border-mindmap-border/30">
        <div className="flex items-center justify-between h-14 px-6">
          <Link href={mode === 'dashboard' ? '/dashboard' : '/'} className="text-mindmap-text-primary font-bold text-lg hover:text-white transition-colors">
            🗺️ MindMap
          </Link>

          <div className="flex items-center gap-3">
            {loading ? null : session ? (
              <>
                {avatarUrl ? (
                  <div
                    role="img"
                    aria-label={userLabel}
                    className="h-7 w-7 rounded-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${avatarUrl})` }}
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-mindmap-accent/70 text-white text-xs font-semibold flex items-center justify-center">
                    {userLabel.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-mindmap-text-primary text-sm hidden sm:inline">
                  {userLabel}
                </span>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="text-sm text-mindmap-text-muted hover:text-white transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="rounded-lg border border-mindmap-border/50 px-4 py-2 text-sm font-medium text-mindmap-text-primary hover:bg-mindmap-accent/20 hover:text-white transition-colors"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal('register')}
                  className="bg-mindmap-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-mindmap-accent/80 transition-colors"
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {authMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-mindmap-border/40 bg-mindmap-bg-primary p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mindmap-accent">
                  MindMap Account
                </p>
                <h2 className="mt-2 text-2xl font-bold text-mindmap-text-primary">
                  {authMode === 'login' ? 'Login' : 'Register'}
                </h2>
                <p className="mt-1 text-sm text-mindmap-text-muted">
                  {authMode === 'login'
                    ? 'Login to save maps to your account.'
                    : 'Create an account to sync your private maps.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAuthModal}
                className="rounded-lg px-2 py-1 text-mindmap-text-muted hover:bg-mindmap-bg-secondary hover:text-white transition-colors"
                aria-label="Close auth modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-mindmap-text-primary">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="w-full rounded-xl border border-mindmap-border/50 bg-mindmap-bg-secondary px-4 py-3 text-sm text-mindmap-text-primary outline-none transition-colors placeholder:text-mindmap-text-muted focus:border-mindmap-accent"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-mindmap-text-primary">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-mindmap-border/50 bg-mindmap-bg-secondary px-4 py-3 text-sm text-mindmap-text-primary outline-none transition-colors placeholder:text-mindmap-text-muted focus:border-mindmap-accent"
                  placeholder="Minimum 6 characters"
                />
              </label>

              {authError && <p className="text-sm text-red-400">{authError}</p>}
              {authMessage && <p className="text-sm text-emerald-400">{authMessage}</p>}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-xl bg-mindmap-accent px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-mindmap-accent/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authLoading
                  ? 'Loading…'
                  : authMode === 'login'
                    ? 'Login'
                    : 'Register'}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-mindmap-border/40" />
              <span className="text-xs text-mindmap-text-muted">or</span>
              <div className="h-px flex-1 bg-mindmap-border/40" />
            </div>

            <button
              type="button"
              onClick={startGoogleLogin}
              className="w-full rounded-xl border border-mindmap-border/50 bg-mindmap-bg-secondary px-4 py-3 text-sm font-semibold text-mindmap-text-primary transition-colors hover:bg-mindmap-accent/20 hover:text-white"
            >
              Sign in with Google
            </button>

            <button
              type="button"
              onClick={() => openAuthModal(authMode === 'login' ? 'register' : 'login')}
              className="mt-4 w-full text-center text-sm text-mindmap-text-muted transition-colors hover:text-white"
            >
              {authMode === 'login'
                ? 'No account yet? Register'
                : 'Already have an account? Login'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
