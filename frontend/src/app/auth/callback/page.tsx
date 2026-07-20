'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setToken } = useWorkspaceStore();

    useEffect(() => {
        const handleCallback = async () => {
            const token = searchParams.get('token');
            const error = searchParams.get('error');

            console.log('🔑 Callback - Token:', token ? 'Yes' : 'No');
            console.log('❌ Callback - Error:', error);

            if (error) {
                router.push('/login?error=google_auth_failed');
                return;
            }

            if (!token) {
                console.log('❌ No token found!');
                router.push('/login');
                return;
            }

            try {
                // Save token
                setToken(token);

                // Fetch logged-in user
                await useWorkspaceStore.getState().fetchCurrentUser();

                console.log('✅ User fetched successfully');

                // Redirect to dashboard
                router.replace('/dashboard');
            } catch (err) {
                console.error('Google login callback failed:', err);
                router.push('/login');
            }
        };

        handleCallback();
    }, [router, searchParams, setToken]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-slate-600">Signing you in...</p>
            </div>
        </div>
    );
}

export default function AuthCallback() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-white">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-slate-600">Loading...</p>
                    </div>
                </div>
            }
        >
            <AuthCallbackContent />
        </Suspense>
    );
}