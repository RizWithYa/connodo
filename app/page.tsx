'use client';

import { ArrowRight, GitBranch, Globe, Layers, Share2, Shield, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';

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

export default function LandingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [showGuestWarning, setShowGuestWarning] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace('/dashboard');
      } else {
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/dashboard');
      } else {
        setChecking(false);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, [router]);

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
              Free guest mode &middot; Sign in to save and share
            </div>

            <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-mindmap-text-primary animate-fade-in-up delay-100">
              Let Ideas
              <br />
              <span className="text-white">Grow in Branches</span>
            </h1>

            <p className="text-lg sm:text-xl text-mindmap-text-muted max-w-xl animate-fade-in-up delay-200">
              Create beautiful mindmaps, branch thoughts in every direction, and save your best work when you are ready.
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 animate-fade-in-up delay-300">
              <button
                type="button"
                onClick={() => setShowGuestWarning(true)}
                className="rounded-xl bg-mindmap-accent px-8 py-4 text-base font-semibold text-white hover:bg-mindmap-accent/80 transition-all shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2"
              >
                Guest Mode <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#fitur"
                className="rounded-xl border border-mindmap-border/50 px-8 py-4 text-base font-semibold text-mindmap-text-primary hover:bg-mindmap-accent/20 hover:text-white transition-all"
              >
                See Features
              </a>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-30">
            <svg className="w-6 h-6 text-mindmap-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <title>Scroll down</title>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </section>

        <section id="fitur" className="relative py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-mindmap-text-primary">
                Simple, Fast, Focused
              </h2>
              <p className="mt-4 text-mindmap-text-muted max-w-lg mx-auto">
                Everything you need to map ideas clearly, from quick sketches to structured plans.
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
              Ready to Map Freely?
            </h2>
            <p className="text-mindmap-text-muted mb-8 max-w-md mx-auto">
              Use Guest Mode for a quick draft, or sign in to keep and share your mindmaps.
            </p>
            <button
              type="button"
              onClick={() => setShowGuestWarning(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-mindmap-accent px-8 py-4 text-base font-semibold text-white hover:bg-mindmap-accent/80 transition-all shadow-lg transform hover:-translate-y-0.5"
            >
              Continue as Guest <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        <footer className="border-t border-mindmap-border/30 py-8 px-6 text-center">
          <p className="text-xs text-mindmap-text-muted">
            &copy; {new Date().getFullYear()} MindMap &middot; Built for branching thoughts.
          </p>
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
