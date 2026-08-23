'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  Users,
  BookOpen,
  GraduationCap,
  Trophy,
  CheckCircle2,
  RefreshCw,
  Search,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react';
import axios from 'axios';
import Sidebar from '@/components/Layout/Sidebar';

interface AdminStats {
  totalUsers: number;
  totalRoadmaps: number;
  totalTopics: number;
  totalProgress: number;
  totalQuizzes: number;
  content: {
    books: number;
    media: number;
    news: number;
  };
}

interface UserRow {
  id: string;
  email: string;
  role: string;
  credits: number;
  createdAt: string;
  profile?: {
    fullName?: string;
    careerGoal?: string;
    difficulty?: string;
  };
  _count: {
    roadmaps: number;
    badges: number;
    progress: number;
    quizAttempts: number;
  };
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('edlearn_token') : null;
      if (!token) {
        router.push('/login');
        return;
      }

      const [statsRes, usersRes] = await Promise.all([
        axios.get('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`/api/admin/users?search=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.stats);
      if (usersRes.data?.success) {
        setUsers(usersRes.data.users);
        setTotalUsers(usersRes.data.total);
      }
    } catch (err: any) {
      console.error('Admin fetch error:', err);
      if (err.response?.status === 403 || err.response?.status === 401) {
        setIsAuthorized(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchAdminData();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('edlearn_token') : null;
      const res = await axios.patch(
        `/api/admin/users/${userId}/role`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
      }
    } catch (err: any) {
      console.error('Role update error:', err);
      alert(err.response?.data?.error || 'Failed to update user role.');
    }
  };

  if (!isMounted) return null;

  if (!isAuthorized) {
    return (
      <>
        <Sidebar />
        <main className="min-h-screen bg-slate-50 md:ml-60 p-6 flex items-center justify-center">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center shadow-lg">
            <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900">Admin Access Restricted</h2>
            <p className="text-xs text-slate-500 mt-2 mb-6">
              You do not have administrative privileges to view this portal. Please return to the study dashboard.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/60 md:ml-60 p-6 md:p-12 pt-24 md:pt-12">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-600 mb-1">
                <ShieldAlert className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider">Management & Operations</span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admin Dashboard</h1>
              <p className="text-sm text-slate-500 mt-1">
                Platform telemetry, learning metrics, and user permission management.
              </p>
            </div>

            <button
              onClick={fetchAdminData}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>

          {/* Stats Overview Grid */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider mb-2">
                  <Users className="h-4 w-4" />
                  <span>Total Users</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900">{stats.totalUsers}</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-2">
                  <GraduationCap className="h-4 w-4" />
                  <span>Active Roadmaps</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900">{stats.totalRoadmaps}</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Completed Lessons</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900">{stats.totalProgress}</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase tracking-wider mb-2">
                  <Trophy className="h-4 w-4" />
                  <span>Quiz Attempts</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900">{stats.totalQuizzes}</div>
              </div>
            </div>
          )}

          {/* User Management Section */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">User Directory ({totalUsers})</h3>
                <p className="text-xs text-slate-500">Manage user roles, credits, and review progress.</p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchAdminData()}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Credits</th>
                    <th className="py-3.5 px-4">Roadmaps</th>
                    <th className="py-3.5 px-4">Completions</th>
                    <th className="py-3.5 px-4">Joined</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{u.profile?.fullName || 'Student'}</div>
                        <div className="text-slate-400">{u.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                            u.role === 'ADMIN'
                              ? 'bg-rose-100 text-rose-700'
                              : u.role === 'MODERATOR'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{u.credits}</td>
                      <td className="py-3.5 px-4 text-slate-600">{u._count.roadmaps}</td>
                      <td className="py-3.5 px-4 text-slate-600">{u._count.progress}</td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer"
                        >
                          <option value="USER">USER</option>
                          <option value="MODERATOR">MODERATOR</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
