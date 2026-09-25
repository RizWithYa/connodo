'use client';

import { ArrowRight, GitBranch, Globe, Layers, Share2, Shield, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

const FEATURES = [
  {
    icon: GitBranch,
    title: 'Free Branching',
    desc: 'Drag, connect, and arrange nodes from every side. Let ideas grow like living branches.',
  },
  {
    icon: Share2,
    title: 'Instant Sharing',
    desc: 'Share saved maps with view, edit, or owner links. Guest maps stay private and temporary.',
  },
  {
    icon: Layers,
    title: 'Ready Templates',
    desc: 'Start from a blank canvas or use templates for SWOT, brainstorming, projects, and more.',
  },
  {
    icon: Zap,
    title: 'Auto Sync',
    desc: 'Signed-in maps save automatically every 1.5 seconds. No save button needed.',
  },
  {
    icon: Shield,
    title: 'Access Control',
    desc: 'Database-level RLS protects saved maps with unique tokens for every access level.',
  },
  {
    icon: Globe,
    title: 'Export Anywhere',
    desc: 'Download as PNG, PDF, or JSON. Your mindmap, your preferred format.',
  },
];

const COMPARISON = [
  {
    title: 'Guest Mode',
    badge: 'Instant draft',
    description: 'Best for quick ideas you do not need to keep.',
    items: ['No account needed', 'Starts immediately', 'Not saved to database', 'No share links', 'Lost after refresh'],
  },
  {
    title: 'Saved Account',
    badge: 'For real work',
    description: 'Best when the idea matters and needs to be kept.',
    items: ['Auto-save enabled', 'Dashboard history', 'Role-based share links', 'Export anytime', 'Recover across devices'],
  },
];

function BranchDecoration() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.06]"
      viewBox="0 0 800 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Decorative branching mindmap lines</title>
      <path d="M400 580 L400 200" stroke="currentColor" strokeWidth="3" className="animate-draw-line" />
      <path d="M400 380 L280 280" stroke="currentColor" strokeWidth="2" className="animate-draw-line delay-200" />
      <path d="M400 380 L520 280" stroke="currentColor" strokeWidth="2" className="animate-draw-line delay-200" />
      <path d="M400 280 L320 180" stroke="currentColor" strokeWidth="2" className="animate-draw-line delay-400" />
      <path d="M400 280 L480 180" stroke="currentColor" strokeWidth="2" className="animate-draw-line delay-400" />
      <path d="M280 280 L200 220" stroke="currentColor" strokeWidth="1.5" className="animate-draw-line delay-600" />
      <path d="M280 280 L260 200" stroke="currentColor" strokeWidth="1.5" className="animate-draw-line delay-600" />
      <path d="M520 280 L580 220" stroke="currentColor" strokeWidth="1.5" className="animate-draw-line delay-600" />
      <path d="M520 280 L540 200" stroke="currentColor" strokeWidth="1.5" className="animate-draw-line delay-600" />
      <path d="M320 180 L260 110" stroke="currentColor" strokeWidth="1" className="animate-draw-line delay-700" />
      <path d="M320 180 L360 110" stroke="currentColor" strokeWidth="1" className="animate-draw-line delay-700" />
      <path d="M480 180 L440 110" stroke="currentColor" strokeWidth="1" className="animate-draw-line delay-700" />
      <path d="M480 180 L540 110" stroke="currentColor" strokeWidth="1" className="animate-draw-line delay-700" />
      <circle cx="400" cy="200" r="6" fill="currentColor" className="animate-pulse-glow" />
      <circle cx="280" cy="280" r="5" fill="currentColor" className="animate-pulse-glow delay-200" />
      <circle cx="520" cy="280" r="5" fill="currentColor" className="animate-pulse-glow delay-200" />
      <circle cx="320" cy="180" r="4" fill="currentColor" className="animate-pulse-glow delay-400" />
      <circle cx="480" cy="180" r="4" fill="currentColor" className="animate-pulse-glow delay-400" />
      <circle cx="200" cy="220" r="3" fill="currentColor" className="animate-pulse-glow delay-600" />
      <circle cx="260" cy="200" r="3" fill="currentColor" className="animate-pulse-glow delay-600" />
      <circle cx="580" cy="220" r="3" fill="currentColor" className="animate-pulse-glow delay-600" />
      <circle cx="540" cy="200" r="3" fill="currentColor" className="animate-pulse-glow delay-600" />
      <circle cx="260" cy="110" r="2.5" fill="currentColor" className="animate-pulse-glow delay-700" />
      <circle cx="360" cy="110" r="2.5" fill="currentColor" className="animate-pulse-glow delay-700" />
      <circle cx="440" cy="110" r="2.5" fill="currentColor" className="animate-pulse-glow delay-700" />
      <circle cx="540" cy="110" r="2.5" fill="currentColor" className="animate-pulse-glow delay-700" />
    </svg>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto mt-14 w-full max-w-4xl rounded-[2rem] border border-mindmap-border/30 bg-mindmap-bg-secondary/40 p-4 shadow-2xl shadow-black/20 backdrop-blur-sm animate-fade-in-up delay-400">
      <div className="rounded-[1.5rem] border border-mindmap-border/30 bg-slate-950/80 p-5 overflow-hidden">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-300" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <span className="rounded-full bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-200">
            Guest draft
          </span>
        </div>
        <div className="relative min-h-[320px] rounded-2xl p-8" style={{ backgroundColor: '#eef2f7' }}>
          <svg className="absolute inset-0 h-full w-full opacity-30" viewBox="0 0 760 320" fill="none" style={{ color: '#94a3b8' }}>
            <title>Connodo mindmap preview</title>
            <path d="M380 158 C300 120 255 96 200 74" stroke="currentColor" strokeWidth="3" />
            <path d="M380 158 C290 180 235 210 190 254" stroke="currentColor" strokeWidth="3" />
            <path d="M380 158 C475 108 520 84 586 70" stroke="currentColor" strokeWidth="3" />
            <path d="M380 158 C490 182 535 220 610 260" stroke="currentColor" strokeWidth="3" />
          </svg>
          {[
            ['Map your thoughts', 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-blue-200 shadow-blue-100', '#ffffff', '#0f172a'],
            ['Capture', 'left-[9%] top-[12%] border-yellow-200 shadow-yellow-100', '#fef9c3', '#0f172a'],
            ['Connect', 'left-[8%] bottom-[12%] border-green-200 shadow-green-100', '#dcfce7', '#0f172a'],
            ['Plan', 'right-[9%] top-[11%] border-blue-200 shadow-blue-100', '#dbeafe', '#0f172a'],
            ['Share', 'right-[8%] bottom-[11%] border-purple-200 shadow-purple-100', '#f3e8ff', '#0f172a'],
          ].map(([label, classes, bg, fg]) => (
            <div
              key={label}
              className={`absolute rounded-2xl border px-5 py-3 text-sm font-semibold shadow-lg ${classes}`}
              style={{ backgroundColor: bg, color: fg }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [showGuestWarning, setShowGuestWarning] = useState(false);
  const isLoggedIn = !!session;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setChecking(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setChecking(false);
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-mindmap-bg-primary flex items-center justify-center">
        <p className="text-mindmap-text-muted animate-pulse text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <>
      <Navbar mode="landing" />
      <main className="min-h-screen bg-mindmap-bg-primary">
        <section className="relative overflow-hidden min-h-[90vh] flex flex-col items-center justify-center px-6">
          <div className="absolute inset-0 text-mindmap-accent">
            <BranchDecoration />
          </div>

          <div className="absolute top-0 left-1/2 w-full max-w-5xl -translate-x-1/2 h-full overflow-hidden pointer-events-none opacity-30">
            <div className="absolute top-10 left-10 w-64 h-64 bg-mindmap-accent rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-blob" />
            <div className="absolute top-0 right-20 w-72 h-72 bg-mindmap-text-muted rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
            <div className="absolute -bottom-10 left-1/3 w-80 h-80 bg-mindmap-accent rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
          </div>

          <div className="relative z-10 text-center max-w-3xl mx-auto flex flex-col items-center gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-mindmap-border/40 bg-mindmap-bg-secondary/60 px-4 py-1.5 text-xs text-mindmap-text-muted backdrop-blur-sm animate-fade-in-up">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Connodo &middot; A branching workspace for ideas
            </div>

            <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-mindmap-text-primary animate-fade-in-up delay-100">
              Map your thoughts
              <br />
              <span className="text-white">before they disappear</span>
            </h1>

            <p className="text-lg sm:text-xl text-mindmap-text-muted max-w-xl animate-fade-in-up delay-200">
              {isLoggedIn
                ? 'Explore Connodo, then return to your saved workspace whenever you are ready.'
                : 'Start instantly in Guest Mode. Save and share when your ideas matter.'}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 animate-fade-in-up delay-300">
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="rounded-xl bg-mindmap-accent px-8 py-4 text-base font-semibold text-white hover:bg-mindmap-accent/80 transition-all shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2"
                >
                  Open Dashboard <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowGuestWarning(true)}
                  className="rounded-xl bg-mindmap-accent px-8 py-4 text-base font-semibold text-white hover:bg-mindmap-accent/80 transition-all shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2"
                >
                  Guest Mode <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <a
                href="#fitur"
                className="rounded-xl border border-mindmap-border/50 px-8 py-4 text-base font-semibold text-mindmap-text-primary hover:bg-mindmap-accent/20 hover:text-white transition-all"
              >
                See Features
              </a>
            </div>

            {!isLoggedIn && (
              <p className="max-w-md text-xs text-mindmap-text-muted animate-fade-in-up delay-400">
                Guest drafts are temporary. Login or register to keep your maps, share access links, and continue later.
              </p>
            )}
          </div>

          <ProductPreview />

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-30">
            <svg className="w-6 h-6 text-mindmap-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <title>Scroll down</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </section>

        <section className="relative px-6 pb-24">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {COMPARISON.map((mode) => (
              <div
                key={mode.title}
                className="rounded-3xl border border-mindmap-border/30 bg-mindmap-bg-secondary/50 p-7 hover:border-mindmap-accent/60 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-bold text-mindmap-text-primary">{mode.title}</h2>
                  <span className="rounded-full bg-mindmap-accent/20 px-3 py-1 text-xs font-semibold text-mindmap-text-primary">
                    {mode.badge}
                  </span>
                </div>
                <p className="mt-3 text-sm text-mindmap-text-muted">{mode.description}</p>
                <ul className="mt-6 space-y-3">
                  {mode.items.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-mindmap-text-primary">
                      <span className="h-1.5 w-1.5 rounded-full bg-mindmap-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="fitur" className="relative py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-mindmap-text-primary">
                Simple, Fast, Focused
              </h2>
              <p className="mt-4 text-mindmap-text-muted max-w-lg mx-auto">
                Everything you need to map ideas clearly, from quick sketches to saved plans.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.title}
                    className="rounded-2xl border border-mindmap-border/30 bg-mindmap-bg-secondary/50 p-6 hover:border-mindmap-accent/60 hover:bg-mindmap-bg-secondary transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-mindmap-accent/20 flex items-center justify-center mb-4 group-hover:bg-mindmap-accent/30 transition-colors">
                      <Icon className="w-5 h-5 text-mindmap-accent" />
                    </div>
                    <h3 className="text-lg font-semibold text-mindmap-text-primary mb-2">
                      {feat.title}
                    </h3>
                    <p className="text-sm text-mindmap-text-muted leading-relaxed">
                      {feat.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-24 px-6 bg-mindmap-bg-secondary/30">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-mindmap-text-primary text-center mb-16">
              How It Works
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
              <div className="hidden sm:block absolute top-10 left-[20%] right-[20%] h-px bg-mindmap-border/40" />

              {[
                { step: '01', title: 'Start as Guest', desc: 'Try the canvas instantly. Nothing is saved and the map disappears after refresh.' },
                { step: '02', title: 'Branch Your Ideas', desc: 'Drag nodes, connect branches, style shapes, and arrange your thinking freely.' },
                { step: '03', title: 'Sign In to Save', desc: 'Create an account when you want auto-save, dashboard history, and share links.' },
              ].map((s) => (
                <div key={s.step} className="relative text-center flex flex-col items-center gap-3">
                  <div className="relative z-10 w-12 h-12 rounded-full bg-mindmap-bg-primary border-2 border-mindmap-accent flex items-center justify-center text-mindmap-accent font-bold text-sm">
                    {s.step}
                  </div>
                  <h3 className="text-lg font-semibold text-mindmap-text-primary">{s.title}</h3>
                  <p className="text-sm text-mindmap-text-muted max-w-xs">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-mindmap-text-primary mb-4">
              Start with zero friction
            </h2>
            <p className="text-mindmap-text-muted mb-8 max-w-md mx-auto">
              {isLoggedIn
                ? 'You are signed in. Continue from your dashboard to keep every branch saved.'
                : 'Try a temporary guest draft now. Create an account when you want to save the work.'}
            </p>
            <button
              type="button"
              onClick={() => isLoggedIn ? router.push('/dashboard') : setShowGuestWarning(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-mindmap-accent px-8 py-4 text-base font-semibold text-white hover:bg-mindmap-accent/80 transition-all shadow-lg transform hover:-translate-y-0.5"
            >
              {isLoggedIn ? 'Open Dashboard' : 'Continue as Guest'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        <footer className="border-t border-mindmap-border/30 py-8 px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-mindmap-text-muted">
            <p>
              &copy; {new Date().getFullYear()} Connodo &middot; Built for branching thoughts.
            </p>
            <div className="flex items-center gap-5">
              <a
                href="https://github.com/RizWithYa/connodo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                aria-label="GitHub Repository"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12c0 5.303 3.438 9.8 8.205 11.385c.6.113.82-.258.82-.577c0-.285-.01-1.04-.015-2.04c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729c1.205.084 1.838 1.236 1.838 1.236c1.07 1.835 2.809 1.305 3.495.998c.108-.776.417-1.305.76-1.605c-2.665-.3-5.466-1.332-5.466-5.93c0-1.31.465-2.38 1.235-3.22c-.135-.303-.54-1.523.105-3.176c0 0 1.005-.322 3.3 1.23c.96-.267 1.98-.399 3-.405c1.02.006 2.04.138 3 .405c2.28-1.552 3.285-1.23 3.285-1.23c.645 1.653.24 2.873.12 3.176c.765.84 1.23 1.91 1.23 3.22c0 4.61-2.805 5.625-5.475 5.92c.42.36.81 1.096.81 2.22c0 1.606-.015 2.896-.015 3.286c0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </footer>
      </main>

      {showGuestWarning && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-mindmap-border/40 bg-mindmap-bg-primary p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              Guest Mode
            </p>
            <h2 className="mt-2 text-2xl font-bold text-mindmap-text-primary">
              This map will not be saved
            </h2>
            <p className="mt-3 text-sm leading-6 text-mindmap-text-muted">
              Guest Mode is temporary. Your mindmap will not be stored in the database, cannot be shared with a URL, and will disappear if you refresh or leave the page.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowGuestWarning(false)}
                className="rounded-xl border border-mindmap-border/50 px-4 py-3 text-sm font-semibold text-mindmap-text-primary hover:bg-mindmap-accent/20 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => router.push('/guest')}
                className="rounded-xl bg-mindmap-accent px-4 py-3 text-sm font-semibold text-white hover:bg-mindmap-accent/80 transition-colors"
              >
                I Understand, Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
