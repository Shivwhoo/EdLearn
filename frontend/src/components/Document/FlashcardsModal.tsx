'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Loader2, AlertCircle, RefreshCw, Sparkles, Brain, Eye, Keyboard, List, Check, Lightbulb } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import UpgradeModal from '../Billing/UpgradeModal';
import confetti from 'canvas-confetti';

interface FlashcardProgress {
  interval: number;
  easeFactor: number;
  nextReview: string;
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  progress?: FlashcardProgress;
}

interface FlashcardsModalProps {
  topicId: string;
  isOpen: boolean;
  onClose: () => void;
}

type Mode = 'reveal' | 'type' | 'show';

export const FlashcardsModal: React.FC<FlashcardsModalProps> = ({ topicId, isOpen, onClose }) => {
  const { token } = useWorkspaceStore();
  
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  // New UI State
  const [mode, setMode] = useState<Mode>('reveal');
  const [isAnswered, setIsAnswered] = useState(false);
  const [userAnswerInput, setUserAnswerInput] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{ isCorrect: boolean, explanation: string } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      loadFlashcards();
    } else {
      setIsVisible(false);
      setFlashcards([]);
      setCurrentIndex(0);
      setSessionReviewed(0);
      setError(null);
      setIsGenerating(false);
      setIsRateLimited(false);
      setShowUpgradeModal(false);
      resetCardState();
    }
  }, [isOpen, topicId]);

  const resetCardState = () => {
    setIsAnswered(false);
    setUserAnswerInput('');
    setEvaluationResult(null);
  };

  const pollJob = async (jobId: string, maxAttempts: number = 40, interval: number = 1500) => {
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      const res = await axios.get(`/api/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const { state, result, error } = res.data.job;

      if (state === 'completed') return result;
      if (state === 'failed') throw new Error(error || 'Job failed');
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Request timed out. Please try again.');
  };

  const loadFlashcards = async () => {
    setIsGenerating(true);
    setError(null);
    setIsRateLimited(false);

    try {
      const res = await axios.post(`/api/topics/${topicId}/flashcards/generate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data?.success) {
        if (res.data.flashcards) {
          setFlashcards(res.data.flashcards);
        } else if (res.data.jobId) {
          const result = await pollJob(res.data.jobId);
          if (result && result.flashcards) {
            setFlashcards(result.flashcards);
          }
        }
      }
    } catch (err: any) {
      if (err.response?.status === 429) {
        setIsRateLimited(true);
        setError('Rate limit exceeded. Please wait a few minutes and try again.');
      } else if (err.response?.status === 402) {
        setShowUpgradeModal(true);
        setError('Daily free tier limit reached.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to prepare flashcards. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRate = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (submittingRating || !currentCard) return;
    setSubmittingRating(true);
    setError(null);

    try {
      await axios.post(`/api/flashcards/${currentCard.id}/review`, { rating }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSessionReviewed(prev => prev + 1);
      resetCardState();
      
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        setCurrentIndex(prev => prev + 1);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit review.');
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleCheck = async () => {
    if (!userAnswerInput.trim() || isEvaluating || !currentCard) return;
    
    setIsEvaluating(true);
    setError(null);
    try {
      const res = await axios.post(`/api/flashcards/${currentCard.id}/evaluate`, {
        userAnswer: userAnswerInput
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success && res.data.evaluation) {
        setEvaluationResult(res.data.evaluation);
      }
    } catch (err) {
      console.error('Failed to evaluate answer', err);
    } finally {
      setIsEvaluating(false);
      setIsAnswered(true);
    }
  };

  if (!isOpen) return null;

  const currentCard = flashcards[currentIndex];
  const isComplete = flashcards.length > 0 && currentIndex >= flashcards.length;

  const total = flashcards.length;
  const done = Math.min(sessionReviewed, total);
  const progressPct = total > 0 ? (done / total) * 100 : 0;

  return (
    <>
      <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose}></div>
        <div className="relative w-full max-w-[720px] bg-white rounded-[40px] shadow-[0_20px_60px_rgba(0,20,40,0.08)] p-8 pt-10 pb-8 transition-all flex flex-col max-h-[90vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer z-10"
          >
            <X className="h-5 w-5" />
          </button>

          {error && !showUpgradeModal && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-rose-700">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">{error}</p>
                {(isRateLimited || flashcards.length === 0) && (
                  <button
                    onClick={loadFlashcards}
                    disabled={isGenerating}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    Retry Generation
                  </button>
                )}
              </div>
            </div>
          )}

          {isGenerating && flashcards.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-20">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
              <p className="text-sm font-medium">Generating your flashcards...</p>
            </div>
          ) : isComplete ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-scale-in py-20">
              <div className="w-20 h-20 bg-[#e3f3e8] rounded-full flex items-center justify-center mb-6">
                <Sparkles className="h-10 w-10 text-[#1d7a4a]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0b1727] mb-2">Deck Complete!</h3>
              <p className="text-[#6b7a8f] mb-8">You reviewed {sessionReviewed} cards this session.</p>
              <button 
                onClick={onClose}
                className="px-8 py-3 bg-[#1a2634] hover:bg-[#2e3d52] text-white rounded-full font-bold shadow-lg transition-all active:scale-95"
              >
                Close Flashcards
              </button>
            </div>
          ) : currentCard ? (
            <>
              <div className="flex justify-between items-center mb-5">
                <div className="text-[14px] font-medium text-[#6b7a8f]">
                  Card <span className="font-semibold text-[#1a2634]">{currentIndex + 1}</span> of <span className="font-semibold text-[#1a2634]">{total}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-[120px] h-[6px] bg-[#e6edf4] rounded-full overflow-hidden hidden sm:block">
                    <div 
                      className="h-full bg-gradient-to-r from-[#5b7cfa] to-[#7c5bfa] rounded-full transition-all duration-400 ease-out" 
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-[13px] font-medium text-[#5b7cfa] bg-[#eff2ff] px-[14px] py-[4px] rounded-full">
                    {done} reviewed
                  </span>
                </div>
              </div>

              <div className="flex gap-1.5 bg-[#f2f6fc] rounded-[14px] p-1 mb-6">
                <button 
                  onClick={() => setMode('reveal')}
                  className={`flex-1 py-2.5 rounded-[11px] text-[13px] font-medium flex items-center justify-center gap-2 transition-all duration-200 ${mode === 'reveal' ? 'bg-white text-[#1a2634] shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-[#6b7a8f] hover:text-[#1a2634]'}`}
                >
                  <Eye className="h-4 w-4 hidden sm:block" /> Reveal
                </button>
                <button 
                  onClick={() => setMode('type')}
                  className={`flex-1 py-2.5 rounded-[11px] text-[13px] font-medium flex items-center justify-center gap-2 transition-all duration-200 ${mode === 'type' ? 'bg-white text-[#1a2634] shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-[#6b7a8f] hover:text-[#1a2634]'}`}
                >
                  <Keyboard className="h-4 w-4 hidden sm:block" /> Type & Check
                </button>
                <button 
                  onClick={() => { setMode('show'); setIsAnswered(true); }}
                  className={`flex-1 py-2.5 rounded-[11px] text-[13px] font-medium flex items-center justify-center gap-2 transition-all duration-200 ${mode === 'show' ? 'bg-white text-[#1a2634] shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-[#6b7a8f] hover:text-[#1a2634]'}`}
                >
                  <List className="h-4 w-4 hidden sm:block" /> Show Answer
                </button>
              </div>

              <div className="bg-[#fafcff] rounded-[28px] border border-[#eef4fa] p-6 sm:p-10 min-h-[260px] flex flex-col transition-all duration-300 relative">
                <div className="w-full text-center mb-6">
                  <div className="text-[13px] font-semibold text-[#8a9aae] tracking-widest uppercase mb-3">Question</div>
                  <div className="text-xl sm:text-2xl font-semibold text-[#0b1727] leading-snug">
                    {currentCard.front}
                  </div>
                </div>

                {mode === 'type' && !isAnswered && (
                  <div className="w-full mt-3 flex flex-col gap-3 animate-fade-in">
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input 
                        type="text" 
                        value={userAnswerInput}
                        onChange={(e) => setUserAnswerInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                        placeholder="Type your answer…" 
                        className="flex-1 px-5 py-3.5 border-2 border-[#e2ebf4] rounded-[16px] text-[16px] outline-none transition-colors focus:border-[#5b7cfa]"
                      />
                      <button 
                        onClick={handleCheck}
                        disabled={!userAnswerInput.trim() || isEvaluating}
                        className="px-6 py-3.5 bg-[#5b7cfa] hover:bg-[#4a6ae0] disabled:opacity-50 text-white rounded-[16px] font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors"
                      >
                        {isEvaluating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} 
                        Check
                      </button>
                    </div>
                    <div className="text-[15px] font-medium px-4 py-3 rounded-xl bg-[#f5f8ff] min-h-[50px] flex items-center gap-2 text-[#1a3b6b]">
                      💡 Type your guess and press Check.
                    </div>
                  </div>
                )}

                {(isAnswered || mode === 'show') && (
                  <div className="w-full mt-2 animate-fade-in flex flex-col gap-3">
                    {evaluationResult && (
                      <div className={`p-4 rounded-[16px] text-[15px] font-medium border-l-[4px] ${evaluationResult.isCorrect ? 'bg-emerald-50 text-emerald-800 border-emerald-500' : 'bg-rose-50 text-rose-800 border-rose-500'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{evaluationResult.isCorrect ? '✅' : '❌'}</span>
                          <span className="font-bold">{evaluationResult.isCorrect ? 'Correct!' : 'Incorrect'}</span>
                        </div>
                        <p className="opacity-90 leading-relaxed">{evaluationResult.explanation}</p>
                      </div>
                    )}
                    
                    <div className="bg-[#f0f6ff] p-5 rounded-[16px] text-[16px] sm:text-[18px] font-medium text-[#1a3b6b] border-l-[4px] border-[#5b7cfa] text-left">
                      <span className="text-xs uppercase tracking-widest font-bold text-[#5b7cfa] mb-2 block">Expected Answer</span>
                      {currentCard.back}
                    </div>
                  </div>
                )}

                {mode === 'reveal' && !isAnswered && (
                  <div className="w-full mt-7 flex justify-center animate-fade-in">
                    <button 
                      onClick={() => setIsAnswered(true)}
                      className="bg-[#eef4fa] hover:bg-[#dce6f0] text-[#1a2634] border-none px-7 py-3.5 rounded-[30px] font-semibold text-[15px] cursor-pointer transition-colors inline-flex items-center gap-2.5"
                    >
                      <Lightbulb className="h-4 w-4 text-[#5b7cfa]" /> Reveal Answer
                    </button>
                  </div>
                )}

                {(isAnswered || mode === 'show') && (
                  <div className="w-full flex flex-wrap justify-center gap-2.5 mt-8 animate-fade-in">
                    <button 
                      onClick={() => handleRate('again')} disabled={submittingRating}
                      className="px-5 py-2.5 bg-[#ffedee] hover:bg-[#fdd8da] text-[#b33a3a] border-none rounded-[40px] font-semibold text-[14px] transition-colors disabled:opacity-50"
                    >
                      🔄 Again
                    </button>
                    <button 
                      onClick={() => handleRate('hard')} disabled={submittingRating}
                      className="px-5 py-2.5 bg-[#fff4e5] hover:bg-[#fdebd0] text-[#b8692a] border-none rounded-[40px] font-semibold text-[14px] transition-colors disabled:opacity-50"
                    >
                      😓 Hard
                    </button>
                    <button 
                      onClick={() => handleRate('good')} disabled={submittingRating}
                      className="px-5 py-2.5 bg-[#e3f3e8] hover:bg-[#cde8d7] text-[#1d7a4a] border-none rounded-[40px] font-semibold text-[14px] transition-colors disabled:opacity-50"
                    >
                      😊 Good
                    </button>
                    <button 
                      onClick={() => handleRate('easy')} disabled={submittingRating}
                      className="px-5 py-2.5 bg-[#e1ecff] hover:bg-[#c7dbfd] text-[#2b5bb8] border-none rounded-[40px] font-semibold text-[14px] transition-colors disabled:opacity-50"
                    >
                      🚀 Easy
                    </button>
                  </div>
                )}
              </div>
              
              {(!isAnswered && mode !== 'show') && (
                <div className="mt-4 text-center text-[13px] text-[#8a9aae] flex items-center justify-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Answer first, then rate your recall.
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => {
          setShowUpgradeModal(false);
          onClose();
        }} 
        message="You've reached your daily free limit for Flashcards."
      />
    </>
  );
};

export default FlashcardsModal;
