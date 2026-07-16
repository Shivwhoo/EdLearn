'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Layers, ShieldCheck } from 'lucide-react';
import Footer from '@/components/Layout/Footer';

export default function AboutPage() {
  return (
    <main className="bg-white text-slate-900 overflow-x-hidden">
      <section className="relative bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="absolute top-[-10%] right-[-5%] w-[45%] h-[45%] bg-blue-200/30 rounded-full blur-[100px]" />
        <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24 relative z-10 text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            About{' '}
            <span className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
              EdLearn
            </span>
          </h1>
          <p className="text-slate-600 max-w-xl mx-auto text-base leading-relaxed">
            Learn how we combine semantic web search, multi-pass AI review models, and interactive
            accessibility to rebuild the online study guide.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-20 lg:pb-28">
        <div className="space-y-8">
          {/* Mission */}
          <div className="flex flex-col md:flex-row gap-6 p-6 sm:p-8 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600 w-fit h-fit flex-shrink-0">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-800">The Active Learning Mission</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Traditional education resources like long video tutorials encourage passive
                scrolling and low information retention. EdLearn targets cognitive focus. We break
                objectives down into modular milestones and deliver structured text documentation
                that students can interact with, read, and listen to simultaneously.
              </p>
            </div>
          </div>

          {/* RAG pipeline */}
          <div className="flex flex-col md:flex-row gap-6 p-6 sm:p-8 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600 w-fit h-fit flex-shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-800">Anti-Hallucination RAG Architecture</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                To guarantee academic truth, our server performs real-time searches on topic
                requests. It scrapes source extracts (like Wikipedia and web content) and enforces a{' '}
                <strong className="text-slate-800 font-semibold">Double-Pass Review heuristic</strong>:
              </p>
              <ul className="list-disc list-inside text-xs text-slate-500 space-y-1 pl-2">
                <li>
                  <strong className="text-slate-700 font-semibold">Pass 1:</strong> Synthesizes
                  initial notes structure from scraped references.
                </li>
                <li>
                  <strong className="text-slate-700 font-semibold">Pass 2:</strong> Re-checks the
                  content block-by-block, marking inline indices{' '}
                  <code className="text-blue-600 font-mono text-[11px]">[1]</code>,{' '}
                  <code className="text-blue-600 font-mono text-[11px]">[2]</code> and correcting
                  assumptions or logic gaps.
                </li>
              </ul>
            </div>
          </div>

          {/* Tech stack */}
          <div className="flex flex-col md:flex-row gap-6 p-6 sm:p-8 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 w-fit h-fit flex-shrink-0">
              <Layers className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-800">Our Modern Technical Stack</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Our application is split into a robust Next.js client layout supported by Zustand
                store management and an Express/TypeScript server. Data operations are securely
                isolated: PostgreSQL tracks users and daily lesson states (via Prisma), while
                MongoDB/Mongoose handles public doubt threads and scraped job market indicators.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold tracking-[0.01em] shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-95 transition-all cursor-pointer"
          >
            <span>Create Free Account</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
