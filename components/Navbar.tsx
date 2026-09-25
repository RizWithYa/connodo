'use client';

import type { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Network, X } from 'lucide-react';
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
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-mindmap-accent/30 text-white" aria-hidden>
              <Network className="w-4 h-4 text-emerald-400" />
            </span>
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
                <a
                  href="https://github.com/RizWithYa/connodo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-2 text-mindmap-text-muted hover:bg-white/[0.07] hover:text-white transition-all inline-flex items-center justify-center"
                  aria-label="GitHub Repository"
                  title="GitHub"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12c0 5.303 3.438 9.8 8.205 11.385c.6.113.82-.258.82-.577c0-.285-.01-1.04-.015-2.04c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729c1.205.084 1.838 1.236 1.838 1.236c1.07 1.835 2.809 1.305 3.495.998c.108-.776.417-1.305.76-1.605c-2.665-.3-5.466-1.332-5.466-5.93c0-1.31.465-2.38 1.235-3.22c-.135-.303-.54-1.523.105-3.176c0 0 1.005-.322 3.3 1.23c.96-.267 1.98-.399 3-.405c1.02.006 2.04.138 3 .405c2.28-1.552 3.285-1.23 3.285-1.23c.645 1.653.24 2.873.12 3.176c.765.84 1.23 1.91 1.23 3.22c0 4.61-2.805 5.625-5.475 5.92c.42.36.81 1.096.81 2.22c0 1.606-.015 2.896-.015 3.286c0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                </a>
          </div>
        </div>
      </nav>

      {authMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-mindmap-bg-primary bg-gradient-to-b from-[#1e2d4a] to-mindmap-bg-primary p-6 shadow-2xl">
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
                className="rounded-lg p-1.5 text-mindmap-text-muted hover:bg-mindmap-bg-secondary hover:text-white transition-colors"
                aria-label="Close auth modal"
              >
                <X className="w-4 h-4" />
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
