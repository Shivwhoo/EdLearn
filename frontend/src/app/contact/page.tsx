'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Send, CheckCircle2, ShieldAlert } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMsg('Please complete all form inputs before submitting.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
      confetti({
        particleCount: 40,
        spread: 30,
        colors: ['#6366F1', '#10B981'],
      });
      setName('');
      setEmail('');
      setMessage('');
    }, 1200);
  };

  return (
    <main className="min-h-screen bg-[#0F1117] text-slate-100 flex flex-col justify-between overflow-x-hidden relative pt-24 pb-8">
      {/* Background overlays */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[50%] bg-amber-500/5 rounded-full blur-[120px]" />

      <section className="max-w-xl mx-auto px-6 py-16 relative z-10 flex-1 w-full flex flex-col justify-center">
        <div className="text-center space-y-3 mb-10">
          <h1 className="text-4xl font-black tracking-tight">
            Contact <span className="bg-gradient-to-r from-indigo-300 to-indigo-500 bg-clip-text text-transparent">Support</span>
          </h1>
          <p className="text-slate-400 text-sm">
            Have feature suggestions or setup questions? Leave a message below.
          </p>
        </div>

        {success ? (
          <div className="p-6 bg-slate-900/40 border border-emerald-500/20 rounded-2xl text-center space-y-4 shadow-xl">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 w-fit mx-auto animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">Message Dispatched!</h3>
            <p className="text-xs leading-relaxed text-slate-400 max-w-sm mx-auto">
              Thank you for reaching out. Our student support handlers will review your feedback and get back to you within 24 hours.
            </p>
            <button
              onClick={() => setSuccess(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-all cursor-pointer"
            >
              Send Another Message
            </button>
          </div>
        ) : (
          <div className="w-full bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 shadow-xl">
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs flex items-center space-x-2 mb-6">
                <ShieldAlert className="h-5 w-5 text-rose-500 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleContactSubmit} className="space-y-5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-450 uppercase tracking-wider">Your Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alice Smith"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. alice@example.com"
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-455 uppercase tracking-wider">Message Content</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your feedback, questions, or message..."
                  className="w-full bg-slate-955/60 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg hover:shadow-indigo-500/20 active:scale-95 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Sending Message...</span>
                ) : (
                  <>
                    <span>Send Message</span>
                    <Send className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
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
            <Link href="/about" className="hover:text-slate-400">About</Link>
            <Link href="/login" className="hover:text-slate-400">Sign In</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
