'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { GraduationCap, LogOut, ArrowRight, Info, PhoneCall, Home } from 'lucide-react';

export default function PublicNavbar() {
  const pathname = usePathname();
  const { token, logout, user } = useWorkspaceStore();
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Hide the public navbar inside the workspace dashboard and onboarding screens
  const isDashboardOrOnboarding = pathname.startsWith('/workspace') || pathname.startsWith('/onboarding');
  if (isDashboardOrOnboarding) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <nav className="max-w-7xl mx-auto bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl px-6 py-3 flex items-center justify-between shadow-xl shadow-slate-950/30">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-2 group">
          <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg group-hover:scale-110 transition-transform">
            <GraduationCap className="h-6 w-6 text-indigo-400" />
          </div>
          <span className="text-lg font-bold tracking-wider bg-gradient-to-r from-indigo-300 to-indigo-500 bg-clip-text text-transparent">
            EdLearn
          </span>
        </Link>

        {/* Navigation links */}
        <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-400">
          <Link
            href="/"
            className={`hover:text-slate-200 transition-colors flex items-center gap-1.5 ${
              pathname === '/' ? 'text-indigo-400' : ''
            }`}
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
          <Link
            href="/about"
            className={`hover:text-slate-200 transition-colors flex items-center gap-1.5 ${
              pathname === '/about' ? 'text-indigo-400' : ''
            }`}
          >
            <Info className="h-4 w-4" />
            About
          </Link>
          <Link
            href="/contact"
            className={`hover:text-slate-200 transition-colors flex items-center gap-1.5 ${
              pathname === '/contact' ? 'text-indigo-400' : ''
            }`}
          >
            <PhoneCall className="h-4 w-4" />
            Contact
          </Link>
        </div>

        {/* Action Button Segment */}
        <div className="flex items-center space-x-4">
          {isMounted && token ? (
            <>
              <span className="text-xs text-slate-500 hidden sm:inline">
                Welcome, <span className="text-indigo-300 font-semibold">{user?.fullName || 'Student'}</span>
              </span>
              <Link
                href="/dashboard"
                className="px-4 py-2 bg-indigo-600/10 border border-indigo-500/30 hover:bg-indigo-600 hover:border-indigo-600 hover:shadow-lg hover:shadow-indigo-500/20 text-indigo-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Dashboard
              </Link>
              <Link
                href="/hub"
                className="px-4 py-2 bg-indigo-600/10 border border-indigo-500/30 hover:bg-indigo-600 hover:border-indigo-600 hover:shadow-lg hover:shadow-indigo-500/20 text-indigo-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Hub
              </Link>
              <button
                onClick={logout}
                className="p-2 bg-slate-800/80 hover:bg-rose-500/15 border border-slate-700 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 rounded-xl transition-all cursor-pointer"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs font-bold text-slate-400 hover:text-slate-100 transition-colors px-3 py-2 cursor-pointer"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
