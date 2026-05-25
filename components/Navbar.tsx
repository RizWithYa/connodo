'use client';

import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { signInWithGoogle, signOut, onAuthStateChange } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function Navbar() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 w-full bg-mindmap-bg-primary border-b border-mindmap-border/30">
      <div className="flex items-center justify-between h-14 px-6">
        {/* Left: App name */}
        <span className="text-mindmap-text-primary font-bold text-lg">MindMap</span>

        {/* Right: Theme + Auth controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-full text-mindmap-text-primary hover:bg-mindmap-accent/30 transition-colors"
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>

          {loading ? null : session ? (
            <>
              <img
                src={session.user.user_metadata.avatar_url}
                alt=""
                className="w-7 h-7 rounded-full"
              />
              <span className="text-mindmap-text-primary text-sm">
                {session.user.user_metadata.full_name}
              </span>
              <button
                onClick={() => signOut()}
                className="text-sm text-mindmap-text-muted hover:text-white transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => signInWithGoogle()}
              className="bg-mindmap-accent text-white rounded-lg px-4 py-2 text-sm hover:bg-mindmap-accent/80 transition-colors"
            >
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
