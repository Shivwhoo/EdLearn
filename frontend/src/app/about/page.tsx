'use client';

import React from 'react';
import Link from 'next/link';
import { GraduationCap, ArrowRight, BookOpen, Layers, ShieldCheck, HelpCircle } from 'lucide-react';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0F1117] text-slate-100 flex flex-col justify-between overflow-x-hidden relative pt-24 pb-8">
      {/* Background overlays */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[10%] left-[-10%] w-[50%] h-[50%] bg-amber-500/5 rounded-full blur-[120px]" />

      <section className="max-w-4xl mx-auto px-6 py-16 relative z-10 flex-1">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black tracking-tight leading-tight">
            About <span className="bg-gradient-to-r from-indigo-300 to-indigo-500 bg-clip-text text-transparent">EdLearn</span>
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
            Learn how we combine semantic web search, multi-pass AI review models, and interactive accessibility to rebuild the online study guide.
          </p>
        </div>

        <div className="mt-16 space-y-12">
          {/* Mission */}
          <div className="flex flex-col md:flex-row gap-6 p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 w-fit h-fit flex-shrink-0">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-200">The Active Learning Mission</h3>
              <p className="text-sm leading-relaxed text-slate-400">
                Traditional education resources like long video tutorials encourage passive scrolling and low information retention. EdLearn targets cognitive focus. We break objectives down into modular milestones and deliver structured text documentation that students can interact with, read, and listen to simultaneously.
              </p>
            </div>
          </div>

          {/* RAG pipeline */}
          <div className="flex flex-col md:flex-row gap-6 p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 w-fit h-fit flex-shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-200">Anti-Hallucination RAG Architecture</h3>
              <p className="text-sm leading-relaxed text-slate-400">
                To guarantee academic truth, our server performs real-time searches on topic requests. It scrapes source extracts (like Wikipedia and web content) and enforces a **Double-Pass Review heuristic**:
              </p>
              <ul className="list-disc list-inside text-xs text-slate-500 space-y-1 pl-2">
                <li>**Pass 1:** Synthesizes initial notes structure from scraped references.</li>
                <li>**Pass 2:** Re-checks the content block-by-block, marking inline indices `[1]`, `[2]` and correcting assumptions or logic gaps.</li>
              </ul>
            </div>
          </div>

          {/* Tech stack */}
          <div className="flex flex-col md:flex-row gap-6 p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 w-fit h-fit flex-shrink-0">
              <Layers className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-200">Our Modern Technical Stack</h3>
              <p className="text-sm leading-relaxed text-slate-400">
                Our application is split into a robust Next.js 15 client layout supported by Zustand store management and an Express/TypeScript server. Data operations are securely isolated: PostgreSQL tracks users and daily lesson states (via Prisma 7), while MongoDB/Mongoose handles public doubt threads and scraped job market indicators.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <span>Create Free Account</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900/80 py-8 bg-slate-950/40 z-10 mt-16 w-full">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center space-x-2">
            <GraduationCap className="h-5 w-5 text-indigo-500" />
            <span className="font-bold text-slate-400">EdLearn © 2026</span>
          </div>
          <div className="flex space-x-6">
            <Link href="/" className="hover:text-slate-400">Home</Link>
            <Link href="/contact" className="hover:text-slate-400">Contact</Link>
            <Link href="/login" className="hover:text-slate-400">Sign In</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
