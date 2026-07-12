'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { GraduationCap, ArrowRight, Sparkles, BookOpen, Brain, MessageSquare, Volume2, ShieldCheck, Zap } from 'lucide-react';

export default function LandingPage() {
  const { token } = useWorkspaceStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Use null during SSR / pre-mount so server and client render identically
  const isLoggedIn = isMounted && !!token;

  return (
    <main className="min-h-screen bg-[#0F1117] text-slate-100 flex flex-col justify-between overflow-x-hidden relative pt-24">
      {/* Background radial overlays */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[50%] bg-amber-500/5 rounded-full blur-[120px]" />

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center relative z-10 flex-1 flex flex-col justify-center items-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-semibold mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Next-Generation Adaptive Learning</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight max-w-4xl bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
          Master Any Skill with Personalized, <span className="bg-gradient-to-r from-indigo-400 to-indigo-600 bg-clip-text text-transparent">AI-Structured</span> Study Paths
        </h1>

        <p className="text-slate-400 text-base sm:text-lg max-w-2xl mt-6 leading-relaxed">
          EdLearn replaces passive video-watching with active, citation-backed, retrieval-augmented study guides. We map out your custom roadmap, generate premium study notes, and highlight text inline as you listen.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-10">
          <Link
            href={isLoggedIn ? "/workspace" : "/signup"}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
          >
            <span>{isLoggedIn ? "Go to Workspace" : "Start Learning Free"}</span>
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/about"
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 rounded-2xl font-bold transition-all cursor-pointer"
          >
            <span>How it Works</span>
          </Link>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section className="max-w-6xl mx-auto px-6 py-20 relative z-10 border-t border-slate-800/60 w-full">
        <h2 className="text-center text-2xl sm:text-3xl font-black text-slate-200 mb-12">
          Engineered for Active Learning
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Card 1 */}
          <div className="p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-4 hover:border-indigo-500/30 transition-all hover:scale-[1.01]">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 w-fit">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">5-Day Structured Roadmaps</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              Input any learning objective and experience level. The system generates an achievable daily timeline divided into focused sub-modules.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-4 hover:border-indigo-500/30 transition-all hover:scale-[1.01]">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 w-fit">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">Anti-Hallucination RAG</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              Double-pass verification checks all AI-generated text against scraped web references, mapping inline citation index badges to maintain fact-based truth.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-4 hover:border-indigo-500/30 transition-all hover:scale-[1.01]">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 w-fit">
              <Volume2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">Click-to-Speak Highlighter</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              Listen to your study notes with a native Web Speech reader. Click on any sentence inside the lesson window to jump playback directly to that position.
            </p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900/80 py-8 bg-slate-950/40 z-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center space-x-2">
            <GraduationCap className="h-5 w-5 text-indigo-500" />
            <span className="font-bold text-slate-400">EdLearn © 2026</span>
          </div>
          <div className="flex space-x-6">
            <Link href="/about" className="hover:text-slate-400">About</Link>
            <Link href="/contact" className="hover:text-slate-400">Contact</Link>
            <Link href="/login" className="hover:text-slate-400">Sign In</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
