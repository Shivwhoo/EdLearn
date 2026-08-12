'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { GraduationCap, Lock, Mail, ArrowRight, ShieldAlert, RefreshCw } from 'lucide-react';
import axios from 'axios';

export default function LoginPage() {
  const router = useRouter();
  const { token, setToken, fetchCurrentUser } = useWorkspaceStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Already logged in redirect
  useEffect(() => {
    if (token) {
      router.push('/dashboard');
    }
  }, [token, router]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Please specify both your email and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password,
      });

      if (response.data?.success) {
        // Authenticate
        setToken(response.data.token);
        await fetchCurrentUser();
        //setUser(response.data.user);
        // Next.js will auto-redirect in useEffect
      } else {
        setErrorMsg('Authentication failed. Check your credentials.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to authenticate with backend server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-white flex flex-col items-center justify-center px-4 pt-28 pb-12 overflow-hidden">
      {/* Visual background accents */}
      <div className="absolute top-[-5%] left-[-10%] w-72 h-72 bg-blue-200/40 rounded-full blur-3xl" />
      <div className="absolute bottom-[-5%] right-[-10%] w-72 h-72 bg-indigo-200/30 rounded-full blur-3xl" />

      <div className="w-full max-w-md bg-white rounded-2xl p-8 space-y-6 relative z-10 shadow-xl border border-slate-100">
        <div className="flex flex-col items-center text-center space-y-2">
          <Link href="/" className="p-3 bg-blue-600 rounded-full text-white hover:scale-105 transition-transform">
            <GraduationCap className="h-8 w-8" />
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-2">Welcome Back</h1>
          <p className="text-slate-500 text-xs">Sign in to resume your learning goals</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-xs flex items-center space-x-2">
            <ShieldAlert className="h-5 w-5 text-rose-500 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Mail className="h-4.5 w-4.5" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 uppercase tracking-wider">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Lock className="h-4.5 w-4.5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold tracking-[0.01em] shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-95 flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-slate-500">or continue with</span>
          </div>
        </div>

        {/* Google Sign In Button */}
        {/* Relative path so this goes through the same next.config.ts rewrite
            ("/api/:path*" -> backend) as every other API call in the app —
            works locally (proxies to localhost:5000) and in any deployed
            environment without a hardcoded backend origin. */}
        <button
          onClick={() => window.location.href = '/api/auth/google'}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
          </svg>
          Continue with Google
        </button>

        <div className="text-center pt-2">
          <p className="text-xs text-slate-500">
            Don't have an account?{' '}
            <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
