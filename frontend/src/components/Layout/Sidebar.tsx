'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import {
  LayoutDashboard,
  Compass,
  GraduationCap,
  Library,
  LogOut,
  Menu,
  MonitorPlay,
  Newspaper,
  NotebookPen,
  Sparkles,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Persistent left navigation sidebar for the authenticated app shell
 * (dashboard + hub). Renders three responsive pieces:
 *   - a fixed 240px sidebar on desktop (md and up)
 *   - a fixed top bar with a hamburger on mobile
 *   - a slide-in drawer (with backdrop) on mobile
 *
 * The public marketing navbar (`PublicNavbar`) hides itself on these routes,
 * so this component is the sole chrome for /dashboard and /hub.
 */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Only routes that actually exist — no dead links / 404s.
const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vision-board', label: 'Vision Board', icon: Sparkles },
  { href: '/hub', label: 'Hub', icon: Compass },
  { href: '/workspace', label: 'Study Workspace', icon: NotebookPen },
  { href: '/media', label: 'Media', icon: MonitorPlay },
  { href: '/books', label: 'Books', icon: Library },
  { href: '/news', label: 'News', icon: Newspaper },
];

/** The inner sidebar content, shared by the desktop rail and mobile drawer. */
function SidebarContent({
  pathname,
  userName,
  userEmail,
  showUser,
  onLogout,
  onNavigate,
}: {
  pathname: string;
  userName: string;
  userEmail: string;
  showUser: boolean;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2 h-16 shrink-0 px-5 border-b border-slate-100"
      >
        <div className="p-1.5 bg-blue-600 rounded-lg">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-extrabold tracking-tight text-slate-900">
          EdLearn
        </span>
      </Link>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                active
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 transition-colors ${
                  active
                    ? 'text-blue-600'
                    : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              <span>{label}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer: user identity + logout */}
      <div className="border-t border-slate-100 p-3 space-y-1">
        {showUser && (
          <div className="flex items-center gap-3 px-3.5 py-2">
            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
              {(userName || userEmail || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {userName || 'Student'}
              </p>
              {userEmail && (
                <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>
              )}
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-all cursor-pointer"
        >
          <LogOut className="h-5 w-5 shrink-0 text-slate-400" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useWorkspaceStore();

  const [isMounted, setIsMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Close on Escape for accessibility.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  // Guard user fields against SSR/hydration mismatch.
  const userName = isMounted ? user?.fullName || '' : '';
  const userEmail = isMounted ? user?.email || '' : '';
  const showUser = isMounted && !!user;

  return (
    <>
      {/* Mobile top bar (only below md) */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-16 flex items-center justify-between px-4 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 rounded-lg">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            EdLearn
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {/* Desktop fixed sidebar (md and up) */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-60 flex-col bg-white border-r border-slate-200">
        <SidebarContent
          pathname={pathname}
          userName={userName}
          userEmail={userEmail}
          showUser={showUser}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile drawer + backdrop (always mounted for smooth slide transitions) */}
      <div
        className={`md:hidden fixed inset-0 z-50 ${
          mobileOpen ? '' : 'pointer-events-none'
        }`}
        aria-hidden={!mobileOpen}
      >
        {/* Backdrop */}
        <div
          onClick={() => setMobileOpen(false)}
          className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200 ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {/* Drawer */}
        <aside
          className={`absolute inset-y-0 left-0 w-64 bg-white shadow-xl flex flex-col transition-transform duration-200 ease-out ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="absolute top-4 right-3 z-10 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
          <SidebarContent
            pathname={pathname}
            userName={userName}
            userEmail={userEmail}
            showUser={showUser}
            onLogout={handleLogout}
            onNavigate={() => setMobileOpen(false)}
          />
        </aside>
      </div>
    </>
  );
}
