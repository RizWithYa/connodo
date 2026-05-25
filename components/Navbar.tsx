'use client';

import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { signInWithGoogle, signOut, onAuthStateChange } from '@/lib/supabase';

export default function Navbar() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
    <nav className="fixed top-0 left-0 right-0 z-50 w-full bg-[#111844] border-b border-[#4B5694]/30">
      <div className="flex items-center justify-between h-14 px-6">
        {/* Left: App name */}
        <span className="text-[#EAE0CF] font-bold text-lg">MindMap</span>

        {/* Right: Auth controls */}
        <div className="flex items-center gap-3">
          {loading ? null : session ? (
            <>
              <img
                src={session.user.user_metadata.avatar_url}
                alt=""
                className="w-7 h-7 rounded-full"
              />
              <span className="text-[#EAE0CF] text-sm">
                {session.user.user_metadata.full_name}
              </span>
              <button
                onClick={() => signOut()}
                className="text-sm text-[#7288AE] hover:text-white transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => signInWithGoogle()}
              className="bg-[#4B5694] text-white rounded-lg px-4 py-2 text-sm hover:bg-opacity-80 transition-colors"
            >
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
