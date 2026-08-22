'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import UpgradeModal from '../Billing/UpgradeModal';

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  order: number;
}

interface Quiz {
  id: string;
  questions: Question[];
}

interface QuickCheckModalProps {
  topicId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const QuickCheckModal: React.FC<QuickCheckModalProps> = ({ topicId, isOpen, onClose }) => {
  const { token } = useWorkspaceStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  
  const [answers, setAnswers] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      loadQuiz();
    } else {
      setIsVisible(false);
      // Reset state on close
      setQuiz(null);
      setAnswers([]);
      setCurrentIndex(0);
      setSubmitted(false);
      setScore(null);
      setError(null);
      setIsRateLimited(false);
      setShowUpgradeModal(false);
    }
  }, [isOpen, topicId]);

  const loadQuiz = async () => {
    setLoading(true);
    setError(null);
    setIsRateLimited(false);

    try {
      const res = await axios.post(`/api/topics/${topicId}/quick-check`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success && res.data.quiz) {
        setQuiz(res.data.quiz);
        // Initialize answers array with exact length, filled with -1 (unanswered)
        setAnswers(new Array(res.data.quiz.questions.length).fill(-1));
      }
    } catch (err: any) {
      if (err.response?.status === 429) {
        setIsRateLimited(true);
        setError('Rate limit exceeded. Please wait a few minutes and try again.');
      } else if (err.response?.status === 402) {
        setShowUpgradeModal(true);
        setError('Daily free tier limit reached.');
      } else {
        setError(err.response?.data?.error || 'Failed to generate Quick Check. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (index: number) => {
    if (submitted) return;
    const newAnswers = [...answers];
    newAnswers[currentIndex] = index;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentIndex < (quiz?.questions.length || 0) - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    if (answers.some(a => a === -1)) {
      setError('Please answer all questions before submitting.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Sending answers strictly preserving index alignment with questions array
      const res = await axios.post(`/api/quiz/${quiz.id}/submit`, { answers }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setScore(res.data.score);
        setSubmitted(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentQuestion = quiz?.questions[currentIndex];

  return (
    <>
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div 
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          onClick={onClose}
        ></div>
        <div className="relative w-full max-w-2xl bg-white border border-slate-100 rounded-3xl p-8 shadow-2xl flex flex-col max-h-[90vh]">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="text-2xl font-extrabold text-slate-900 mb-6">Quick Check</h2>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-rose-700">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">{error}</p>
                {(isRateLimited || (!quiz && !showUpgradeModal)) && (
                  <button
                    onClick={loadQuiz}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry Generation
                  </button>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
              <p className="text-sm font-medium">Generating your Quick Check...</p>
            </div>
          ) : quiz && currentQuestion ? (
            <div className="flex-1 overflow-y-auto pr-2">
              
              {/* Progress indicators */}
              <div className="flex gap-2 mb-6">
                {quiz.questions.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-2 flex-1 rounded-full ${
                      idx === currentIndex 
                        ? 'bg-blue-600' 
                        : answers[idx] !== -1 
                          ? 'bg-blue-200' 
                          : 'bg-slate-100'
                    }`}
                  />
                ))}
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-bold text-slate-800 mb-6 leading-relaxed">
                  <span className="text-blue-600 mr-2">{currentIndex + 1}.</span>
                  {currentQuestion.questionText}
                </h3>
                
                <div className="space-y-3">
                  {currentQuestion.options.map((opt, idx) => {
                    const isSelected = answers[currentIndex] === idx;
                    let bgClass = 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50';
                    
                    if (submitted) {
                      if (idx === currentQuestion.correctIndex) {
                        bgClass = 'bg-emerald-50 border-emerald-400 text-emerald-800 font-medium';
                      } else if (isSelected) {
                        bgClass = 'bg-rose-50 border-rose-400 text-rose-800';
                      } else {
                        bgClass = 'bg-slate-50 border-slate-200 opacity-50';
                      }
                    } else if (isSelected) {
                      bgClass = 'bg-blue-50 border-blue-600 shadow-sm';
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectOption(idx)}
                        disabled={submitted}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${bgClass} ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <div className="flex gap-3">
                          <span className={`font-mono text-sm ${submitted && idx === currentQuestion.correctIndex ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {String.fromCharCode(65 + idx)}.
                          </span>
                          <span className="text-sm">{opt}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                
                {submitted && currentQuestion.explanation && (
                  <div className="mt-6 p-4 bg-amber-50/80 border border-amber-100 rounded-xl">
                    <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Explanation</h4>
                    <p className="text-sm text-amber-900/80 leading-relaxed">{currentQuestion.explanation}</p>
                  </div>
                )}
              </div>

            </div>
          ) : null}

          {!loading && quiz && (
            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
              {submitted ? (
                <div className="flex-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    <span className="text-lg font-bold text-slate-800">Score: {score}/{quiz.questions.length}</span>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handlePrev} disabled={currentIndex === 0} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold disabled:opacity-50">Back</button>
                    {currentIndex < quiz.questions.length - 1 ? (
                      <button onClick={handleNext} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold">Next Question</button>
                    ) : (
                      <button onClick={onClose} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Done</button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-between">
                  <button 
                    onClick={handlePrev} 
                    disabled={currentIndex === 0}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    Previous
                  </button>
                  
                  {currentIndex === quiz.questions.length - 1 ? (
                    <button 
                      onClick={handleSubmit} 
                      disabled={submitting || answers.some(a => a === -1)}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer shadow-sm shadow-blue-600/20"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Submit Answers
                    </button>
                  ) : (
                    <button 
                      onClick={handleNext} 
                      className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                    >
                      Next
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => {
          setShowUpgradeModal(false);
          onClose(); // Close the Quick Check modal too since they can't proceed
        }} 
        message="You've reached your daily free limit for Quick Checks."
      />
    </>
  );
};

export default QuickCheckModal;
