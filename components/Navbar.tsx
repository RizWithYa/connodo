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
  mode?: 'landing' | 'dashboard' | 'app';
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
  const [imgError, setImgError] = useState(false);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 w-full bg-gradient-to-r from-mindmap-bg-primary via-mindmap-bg-primary to-[#1f2f4a]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center justify-between h-14 px-6">
          <Link href={mode === 'landing' ? '/' : '/dashboard'} className="flex items-center gap-2 text-white font-bold text-lg hover:opacity-90 transition-opacity">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-mindmap-accent/30 text-sm" aria-hidden>🌿</span>
            Connodo
          </Link>

          <div className="flex items-center gap-4">
            {loading ? null : session ? (
              <>
                <Link
                  href="/"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-mindmap-text-muted hover:bg-white/[0.07] hover:text-white transition-all hidden sm:inline"
                >
                  Home
                </Link>
                {avatarUrl && !imgError ? (
                  <img
                    src={avatarUrl}
                    alt={userLabel}
                    key={avatarUrl}
                    onError={() => setImgError(true)}
                    className="h-8 w-8 rounded-full object-cover ring-2 ring-white/10"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-mindmap-accent to-[#5b7bce] text-white text-xs font-bold flex items-center justify-center ring-2 ring-white/10">
                    {userLabel.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-white/80 text-sm font-medium hidden sm:inline max-w-[140px] truncate">
                  {userLabel}
                </span>
                <div className="h-5 w-px bg-white/10 hidden sm:block" />
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-mindmap-text-muted hover:bg-red-500/10 hover:text-red-400 transition-all"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-mindmap-text-muted hover:bg-white/[0.07] hover:text-white transition-all"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal('register')}
                  className="rounded-lg bg-mindmap-accent px-4 py-2 text-sm font-semibold text-white hover:bg-mindmap-accent/80 shadow-sm transition-all hover:shadow-md"
                >
                  Register
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {authMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#1e2d4a] to-mindmap-bg-primary p-6 shadow-2xl">
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
