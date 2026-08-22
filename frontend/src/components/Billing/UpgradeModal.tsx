import React, { useState } from 'react';
import axios from 'axios';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Sparkles, X, Check, ArrowRight } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export default function UpgradeModal({ isOpen, onClose, message }: UpgradeModalProps) {
  const { token, user } = useWorkspaceStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post('/api/billing/checkout', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start checkout. Please try again.');
      setLoading(false);
    }
  };

  const isPro = user?.subscription?.tier === 'PRO';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header Graphic */}
        <div className="h-32 bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
          <Sparkles className="w-12 h-12 text-white opacity-90 drop-shadow-lg" />
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-1.5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Upgrade to EdLearn Pro</h2>
            <p className="text-slate-400 text-sm">
              {message || "You've reached your daily limit for AI generations on the free tier."}
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <FeatureItem text="Unlimited AI Quizzes & Flashcards" />
            <FeatureItem text="Advanced Socratic Mode (Coming Soon)" />
            <FeatureItem text="Duo Podcast Generation (Coming Soon)" />
            <FeatureItem text="Priority support & early access to features" />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {isPro ? (
            <div className="text-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <Check className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-emerald-400 font-medium">You are already a Pro member!</p>
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Get Pro for $9.99/mo</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          )}
          
          <p className="text-center text-xs text-slate-500 mt-4">
            Cancel anytime. Secure payment via Stripe.
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 bg-indigo-500/20 p-1 rounded-full text-indigo-400 shrink-0">
        <Check className="w-3.5 h-3.5" />
      </div>
      <span className="text-slate-300 text-sm leading-tight">{text}</span>
    </div>
  );
}
