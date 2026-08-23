'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

/**
 * /vision-board no longer exists as its own page — the Vision Board is now
 * <VisionBoardModal />, opened from the Sidebar's "Vision Board" button or
 * the reminder banner on /dashboard (see those files). This route is kept
 * only so old bookmarks/links don't 404; it just bounces to the dashboard,
 * where the Vision Board is one click away.
 */
export default function VisionBoardRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
      <RefreshCw className="mr-2 h-6 w-6 animate-spin text-blue-600" />
      <span>Vision Board has moved — redirecting to your dashboard...</span>
    </div>
  );
}
