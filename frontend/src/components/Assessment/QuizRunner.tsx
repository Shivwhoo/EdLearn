'use client';

import React, { useState } from 'react';
import { CheckCircle2, XCircle, Trophy, RefreshCw, ArrowRight, HelpCircle, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import axios from 'axios';

export interface QuizQuestion {
  id?: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

interface QuizRunnerProps {
  dayId: string;
  topicTitle: string;
  questions: QuizQuestion[];
  onComplete?: (score: number, total: number) => void;
}

export default function QuizRunner({ dayId, topicTitle, questions, onComplete }: QuizRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; percentage: number; passed: boolean; feedback: string } | null>(null);

  if (!questions || questions.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-sm">
        No assessment questions are available for this lesson yet.
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const allAnswered = questions.every((_, idx) => selectedAnswers[idx] !== undefined);

  const handleSelectOption = (optionIdx: number) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: optionIdx }));
  };

  const handleSubmitQuiz = async () => {
    if (!allAnswered || isSubmitting) return;

    let score = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        score++;
      }
    });

    setIsSubmitting(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('edlearn_token') : null;
      const res = await axios.post(
        '/api/quiz/submit',
        {
          dayId,
          score,
          totalQuestions: questions.length,
          answers: selectedAnswers,
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (res.data?.success) {
        setResult({
          score,
          percentage: res.data.percentage,
          passed: res.data.passed,
          feedback: res.data.feedback,
        });
        setIsSubmitted(true);

        if (res.data.passed) {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.7 },
            colors: ['#10B981', '#2563EB', '#F59E0B'],
          });
        }

        if (onComplete) {
          onComplete(score, questions.length);
        }
      }
    } catch (err) {
      console.error('Quiz submit error:', err);
      // Local fallback calculation if offline
      const percentage = Math.round((score / questions.length) * 100);
      setResult({
        score,
        percentage,
        passed: percentage >= 70,
        feedback: percentage >= 70 ? 'Well done!' : 'Keep practicing!',
      });
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setIsSubmitted(false);
    setResult(null);
    setCurrentIndex(0);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-blue-100">
              Interactive Assessment
            </span>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-white/10 rounded-full">
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>
        <h2 className="text-xl font-bold mt-2">{topicTitle}</h2>
      </div>

      {/* Results View */}
      {isSubmitted && result ? (
        <div className="p-8 text-center space-y-6">
          <div
            className={`h-20 w-20 mx-auto rounded-3xl flex items-center justify-center shadow-lg ${
              result.passed
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-emerald-500/30'
                : 'bg-gradient-to-tr from-amber-500 to-rose-400 text-white shadow-amber-500/30'
            }`}
          >
            <Trophy className="h-10 w-10" />
          </div>

          <div>
            <div className="text-3xl font-black text-slate-900">
              {result.score} / {questions.length} ({result.percentage}%)
            </div>
            <p className="text-sm font-semibold text-slate-700 mt-1">{result.feedback}</p>
          </div>

          {/* Breakdown per question */}
          <div className="text-left space-y-4 max-w-2xl mx-auto border-t border-slate-100 pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Answer Review & Explanations
            </h3>
            {questions.map((q, idx) => {
              const userAns = selectedAnswers[idx];
              const isCorrect = userAns === q.correctIndex;
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border ${
                    isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-slate-900">{q.question}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        <span className="font-semibold">Your answer:</span> {q.options[userAns]}
                      </p>
                      {!isCorrect && (
                        <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                          <span>Correct answer:</span> {q.options[q.correctIndex]}
                        </p>
                      )}
                      {q.explanation && (
                        <p className="text-xs text-slate-500 mt-2 italic bg-white/80 p-2 rounded border border-slate-200/60">
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleRetake}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Retake Assessment</span>
          </button>
        </div>
      ) : (
        /* Active Question View */
        <div className="p-6 sm:p-8 space-y-6">
          {/* Question text */}
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-extrabold text-xs">
              {currentIndex + 1}
            </span>
            <p className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {currentQ.question}
            </p>
          </div>

          {/* Options list */}
          <div className="space-y-3">
            {currentQ.options.map((opt, optIdx) => {
              const isSelected = selectedAnswers[currentIndex] === optIdx;
              return (
                <button
                  key={optIdx}
                  onClick={() => handleSelectOption(optIdx)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border text-left text-sm font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border-blue-400 text-blue-900 ring-2 ring-blue-100'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 text-slate-400'
                      }`}
                    >
                      {String.fromCharCode(65 + optIdx)}
                    </span>
                    <span>{opt}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Stepper & Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              Previous
            </button>

            <div className="flex items-center gap-1.5">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === currentIndex
                      ? 'w-6 bg-blue-600'
                      : selectedAnswers[i] !== undefined
                      ? 'w-2 bg-emerald-500'
                      : 'w-2 bg-slate-200'
                  }`}
                />
              ))}
            </div>

            {isLastQuestion ? (
              <button
                onClick={handleSubmitQuiz}
                disabled={!allAnswered || isSubmitting}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>Submit Assessment</span>
              </button>
            ) : (
              <button
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Next</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
