'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Mail, Phone, MapPin, Camera, MessageCircle, Globe, CheckCircle2 } from 'lucide-react';

// This project's installed lucide-react version has no brand/logo icons
// (Instagram, Twitter, etc. were removed for trademark reasons). Generic
// glyphs stand in for them below, matching the convention already used in
// components/Landing — the links and aria-labels still point at the
// intended destinations.

export default function Footer() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // No backend/API call here on purpose — there is no newsletter endpoint
  // wired up yet, so this just gives the visitor instant local feedback.
  // When a real endpoint exists, swap the body of this handler for the
  // fetch/axios call and keep the same success/error state transitions.
  const handleNewsletterSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    // Simulate a brief pending state so the button feedback doesn't feel instant/fake.
    window.setTimeout(() => {
      setIsSubmitting(false);
      setIsSubscribed(true);
      setEmail('');
    }, 400);
  };

  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand + blurb + socials */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2 group w-fit">
              <div className="p-1.5 bg-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-extrabold text-white tracking-tight">EdLearn</span>
            </Link>
            <p className="text-sm leading-relaxed max-w-xs">
              The all-in-one learning platform for curious minds. AI tutoring, quizzes, career
              guidance, and mentor connections — learn smarter, faster, better.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="p-2 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition-colors"
              >
                <Camera className="h-4 w-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                className="p-2 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
              <a
                href="https://edlearn.app"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Website"
                className="p-2 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition-colors"
              >
                <Globe className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Company */}
          <nav aria-label="Company">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Company</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Careers</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Blog</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </nav>

          {/* Support */}
          <nav aria-label="Support">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Support</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/contact" className="hover:text-white transition-colors">Help Center</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">FAQs</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            </ul>
          </nav>

          {/* Contact */}
          <div className="sm:col-span-2 lg:col-span-1 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Contact</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <a href="mailto:hello@edlearn.com" className="hover:text-white transition-colors">
                    hello@edlearn.com
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <a href="tel:+2348001234567" className="hover:text-white transition-colors">
                    +234 800 123 4567
                  </a>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>12 Freedom Way, Lekki, Lagos, Nigeria</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Newsletter — client-side only, no API call */}
        <div className="mt-12 pt-10 border-t border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
              Subscribe to our newsletter
            </h3>
            <p className="text-sm">Get the latest updates and learning tips delivered to your inbox.</p>
          </div>

          {isSubscribed ? (
            <div
              className="flex items-center gap-2 w-full md:w-auto max-w-sm px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm font-medium"
              role="status"
            >
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>Thanks for subscribing! Check your inbox soon.</span>
            </div>
          ) : (
            <form
              className="flex w-full md:w-auto max-w-sm gap-2"
              onSubmit={handleNewsletterSubmit}
              suppressHydrationWarning
            >
              <label htmlFor="footer-newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="footer-newsletter-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={isSubmitting}
                autoComplete="email"
                suppressHydrationWarning
                className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                suppressHydrationWarning
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {isSubmitting ? 'Subscribing…' : 'Subscribe'}
              </button>
            </form>
          )}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>&copy; 2026 EdLearn. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="#" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            <Link href="#" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
