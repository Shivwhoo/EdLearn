'use client';

import React, { useState } from 'react';
import { Send, CheckCircle2, ShieldAlert } from 'lucide-react';
import confetti from 'canvas-confetti';
import Footer from '@/components/Layout/Footer';

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
        colors: ['#2563EB', '#10B981'],
      });
      setName('');
      setEmail('');
      setMessage('');
    }, 1200);
  };

  return (
    <main className="bg-white text-slate-900 overflow-x-hidden flex flex-col min-h-screen">
      <section className="relative bg-gradient-to-b from-blue-50 via-white to-white flex-1">
        <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-blue-200/30 rounded-full blur-[100px]" />
        <div className="max-w-xl mx-auto px-6 py-16 lg:py-24 relative z-10 w-full">
          <div className="text-center space-y-3 mb-10">
            <h1 className="text-4xl font-extrabold tracking-tight">
              Contact{' '}
              <span className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                Support
              </span>
            </h1>
            <p className="text-slate-600 text-sm">
              Have feature suggestions or setup questions? Leave a message below.
            </p>
          </div>

          {success ? (
            <div className="p-6 bg-white border border-emerald-100 rounded-2xl text-center space-y-4 shadow-sm">
              <div className="p-3 bg-emerald-50 rounded-full text-emerald-600 w-fit mx-auto animate-bounce">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">Message Dispatched!</h3>
              <p className="text-xs leading-relaxed text-slate-600 max-w-sm mx-auto">
                Thank you for reaching out. Our student support handlers will review your feedback
                and get back to you within 24 hours.
              </p>
              <button
                onClick={() => setSuccess(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-all cursor-pointer"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <div className="w-full bg-white border border-slate-100 rounded-2xl p-8 shadow-sm">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-xs flex items-center gap-2 mb-6">
                  <ShieldAlert className="h-5 w-5 text-rose-500 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleContactSubmit} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 uppercase tracking-wider">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alice Smith"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. alice@example.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 uppercase tracking-wider">
                    Message Content
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your feedback, questions, or message..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-colors resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold tracking-[0.01em] shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-95 flex items-center justify-center gap-2 transition-all cursor-pointer"
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
        </div>
      </section>

      <Footer />
    </main>
  );
}
