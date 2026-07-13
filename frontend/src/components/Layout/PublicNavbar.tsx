'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { GraduationCap, LogOut, ArrowRight, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Help' },
  { href: '#', label: 'Blog' },
];

export default function PublicNavbar() {
  const pathname = usePathname();
  const { token, logout, user } = useWorkspaceStore();
  const [isMounted, setIsMounted] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close the mobile menu on route change
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Hide the public navbar inside the workspace dashboard and onboarding screens
  const isDashboardOrOnboarding = pathname.startsWith('/workspace') || pathname.startsWith('/onboarding');
  if (isDashboardOrOnboarding) return null;

  const isLoggedIn = isMounted && !!token;

  return (
    <header className="sticky top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="p-1.5 bg-blue-600 rounded-lg group-hover:scale-110 transition-transform">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">EdLearn</span>
        </Link>

        {/* Navigation links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-700">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={`hover:text-blue-600 transition-colors ${
                pathname === link.href ? 'text-blue-600 font-semibold' : ''
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Action Button Segment (desktop) */}
        <div className="hidden md:flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <span className="text-xs text-slate-500 hidden lg:inline">
                Welcome, <span className="text-blue-600 font-semibold">{user?.fullName || 'Student'}</span>
              </span>
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-blue-50 hover:bg-blue-600 border border-blue-200 hover:border-blue-600 text-blue-700 hover:text-white rounded-lg text-xs font-semibold tracking-[0.01em] transition-all cursor-pointer"
              >
                Dashboard
              </Link>
              <Link
                href="/hub"
                className="px-4 py-2 bg-blue-50 hover:bg-blue-600 border border-blue-200 hover:border-blue-600 text-blue-700 hover:text-white rounded-lg text-xs font-semibold tracking-[0.01em] transition-all cursor-pointer"
              >
                Hub
              </Link>
              <button
                onClick={logout}
                className="p-2 bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-500 hover:text-rose-600 rounded-lg transition-all cursor-pointer"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors px-3 py-2 cursor-pointer"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger toggle */}
        <button
          type="button"
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((open) => !open)}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile menu panel */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-6 py-6 space-y-6">
          <div className="flex flex-col gap-4 text-sm font-medium text-slate-700">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="hover:text-blue-600 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="w-full text-center px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-semibold"
                >
                  Dashboard
                </Link>
                <Link
                  href="/hub"
                  className="w-full text-center px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-semibold"
                >
                  Hub
                </Link>
                <button
                  onClick={logout}
                  className="w-full text-center px-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold cursor-pointer"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="w-full text-center px-4 py-2.5 text-slate-700 border border-slate-200 rounded-lg text-sm font-semibold"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
