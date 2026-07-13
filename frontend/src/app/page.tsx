'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWorkspaceStore } from '@/store/workspaceStore';
import {
  ArrowRight,
  Bot,
  ListChecks,
  Compass,
  Users,
  MessageCircle,
  BarChart3,
  UserPlus,
  Target,
  Rocket,
  ShieldCheck,
  Zap,
  GraduationCap,
  Quote,
} from 'lucide-react';
import Footer from '@/components/Layout/Footer';

const FEATURES = [
  {
    icon: Bot,
    title: 'AI-Powered Tutor',
    description: 'Get personalized help from our intelligent AI tutor available 24/7.',
  },
  {
    icon: ListChecks,
    title: 'Interactive Quizzes',
    description: 'Test your knowledge with adaptive quizzes that track your progress.',
  },
  {
    icon: Compass,
    title: 'Career Guidance',
    description: 'Find your path with personalized career recommendations and insights.',
  },
  {
    icon: Users,
    title: 'Live Mentor Sessions',
    description: 'Connect with experienced mentors for 1-on-1 guidance.',
  },
  {
    icon: MessageCircle,
    title: 'Doubt Forum',
    description: 'Ask questions and get answers from the EdLearn community.',
  },
  {
    icon: BarChart3,
    title: 'Progress Tracking',
    description: 'Monitor your learning journey with detailed analytics and insights.',
  },
];

const STEPS = [
  {
    icon: UserPlus,
    title: 'Create Your Account',
    description: 'Sign up for free and set up your learning profile in minutes.',
  },
  {
    icon: Target,
    title: 'Choose Your Learning Path',
    description: 'Select topics, set goals, and get personalized recommendations.',
  },
  {
    icon: Rocket,
    title: 'Start Learning & Growing',
    description: 'Access AI tutors, quizzes, mentors, and track your progress.',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'EdLearn completely changed how I study. The AI tutor helps me understand complex topics instantly.',
    name: 'Sarah J.',
    role: 'Computer Science Student',
    initials: 'SJ',
  },
  {
    quote:
      'The career guidance feature helped me discover my passion. I landed my dream internship!',
    name: 'Michael O.',
    role: 'Engineering Graduate',
    initials: 'MO',
  },
  {
    quote:
      'Having a mentor through EdLearn gave me the confidence to start my own business.',
    name: 'Amina K.',
    role: 'Entrepreneurship Student',
    initials: 'AK',
  },
];

export default function LandingPage() {
  const { token } = useWorkspaceStore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Use null during SSR / pre-mount so server and client render identically
  const isLoggedIn = isMounted && !!token;

  return (
    <main className="bg-white text-slate-900 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="absolute top-[-10%] right-[-5%] w-[45%] h-[45%] bg-blue-200/30 rounded-full blur-[100px]" />
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28 relative z-10 grid lg:grid-cols-2 gap-16 items-center">
          {/* Copy column */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-xs font-semibold mb-6">
              <Zap className="h-3.5 w-3.5" />
              <span>Learn Smarter, Faster, Better</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-slate-900">
              Learn Anything,{' '}
              <span className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                Anytime, Anywhere
              </span>
            </h1>

            <p className="text-slate-600 text-base sm:text-lg max-w-xl mt-6 leading-relaxed">
              Your all-in-one learning platform with AI-powered tutoring, interactive quizzes,
              career guidance, and mentor connections — simple, smart, and effective.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-10">
              <Link
                href={isLoggedIn ? '/workspace' : '/signup'}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                <span>{isLoggedIn ? 'Go to Workspace' : 'Start Learning Free'}</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="#how-it-works"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl font-bold transition-all cursor-pointer"
              >
                <span>See How It Works</span>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-10 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span>Safe &amp; private learning</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-blue-600" />
                <span>Instant AI answers</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-blue-600" />
                <span>10,000+ learners</span>
              </div>
            </div>
          </div>

          {/* Visual column — illustrative app preview mockup */}
          <div className="relative">
            <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 shadow-2xl shadow-blue-900/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white/15 rounded-lg">
                    <GraduationCap className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-white font-bold">Hi, Ada 👋</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-200 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  Tutor online
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-lg mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Weekly learning progress
                </p>
                <p className="text-3xl font-extrabold text-slate-900 mb-3">78%</p>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full w-[78%] bg-blue-600 rounded-full" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 border border-white/15 rounded-2xl p-4 backdrop-blur-sm">
                  <p className="text-xs text-blue-100 mb-1">Last quiz score</p>
                  <p className="text-xl font-bold text-white">92%</p>
                </div>
                <div className="bg-white/10 border border-white/15 rounded-2xl p-4 backdrop-blur-sm">
                  <p className="text-xs text-blue-100 mb-1">Mentor session</p>
                  <p className="text-xl font-bold text-white">Fri, 4PM</p>
                </div>
              </div>
            </div>

            {/* Floating chat bubble */}
            <div className="hidden sm:flex absolute -bottom-6 -left-6 items-center gap-3 bg-white rounded-2xl shadow-xl p-4 max-w-[220px] border border-slate-100">
              <div className="p-2 bg-blue-50 rounded-full">
                <Bot className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-xs font-medium text-slate-700">
                &ldquo;Let&rsquo;s break that down step by step!&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-slate-50 py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.01em] text-slate-900">
              Everything you need in one platform
            </h2>
            <p className="text-slate-600 mt-4 leading-relaxed max-w-[65ch] mx-auto">
              EdLearn brings tutoring, practice, mentorship, and career guidance together so you
              never have to juggle five different tools.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className="p-3 bg-blue-50 group-hover:bg-blue-600 rounded-xl text-blue-600 group-hover:text-white w-fit mb-4 transition-colors">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.01em] text-slate-900">
              Get started in 3 simple steps
            </h2>
          </div>

          <div className="relative grid md:grid-cols-3 gap-10 md:gap-6">
            <div className="hidden md:block absolute top-8 left-[16.5%] right-[16.5%] h-0.5 border-t-2 border-dashed border-blue-200" />
            {STEPS.map((step, index) => (
              <div key={step.title} className="relative text-center flex flex-col items-center">
                <div className="relative z-10 flex items-center justify-center h-16 w-16 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/20 mb-6">
                  <step.icon className="h-7 w-7" />
                  <span className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center rounded-full bg-white border-2 border-blue-600 text-blue-600 text-xs font-extrabold">
                    {index + 1}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{step.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600 max-w-xs">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-slate-50 py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">Testimonials</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.01em] text-slate-900">
              Trusted by thousands of learners
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((testimonial) => (
              <figure
                key={testimonial.name}
                className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col"
              >
                <Quote className="h-6 w-6 text-blue-200 mb-3" />
                <blockquote className="text-sm leading-relaxed text-slate-700 flex-1">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <figcaption className="flex items-center gap-3 mt-6">
                  <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {testimonial.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{testimonial.name}</p>
                    <p className="text-xs text-slate-500">{testimonial.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-24 px-6">
        <div className="max-w-7xl mx-auto bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl px-8 py-14 sm:px-16 sm:py-16 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-xl shadow-blue-900/20">
          <div className="text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.01em] text-white">
              Ready to learn smarter?
            </h2>
            <p className="text-blue-100 mt-3 max-w-lg leading-relaxed">
              Join thousands of students already learning faster and better with EdLearn — it&rsquo;s
              free to get started.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 flex-shrink-0">
            <Link
              href={isLoggedIn ? '/workspace' : '/signup'}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-blue-50 text-blue-700 rounded-xl font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            >
              <span>{isLoggedIn ? 'Go to Workspace' : 'Start Learning Free'}</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/contact"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/15 border border-white/25 text-white rounded-xl font-bold transition-all cursor-pointer"
            >
              <span>Talk to Us</span>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
