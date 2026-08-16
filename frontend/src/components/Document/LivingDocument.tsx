import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { BookOpen, RefreshCw, Copy, Check, Lightbulb, List, FileText, ExternalLink, Code, Download, Loader2, CheckCircle2, Zap, Brain } from 'lucide-react';
import confetti from 'canvas-confetti';
import Mermaid from './Mermaid';
import { PodcastPlayer } from './PodcastPlayer';
import { exportNotesPdf } from '@/lib/exportPdf';
import QuickCheckModal from './QuickCheckModal';
import FlashcardsModal from './FlashcardsModal';
interface LivingDocumentProps {
  onTriggerGenerate: () => void;
  sentenceRef: React.MutableRefObject<string[]>;
}

export const LivingDocument: React.FC<LivingDocumentProps> = ({ onTriggerGenerate, sentenceRef }) => {
  const {
    generatedContent,
    isLoadingContent,
    currentDay,
    isPlaying,
    activeSentenceIndex,
    focusMode,
    setPlaying,
    setActiveSentenceIndex,
    notesHistory,
    activeVersionId,
    setActiveVersion,
    completedDays,
    markDayCompleted,
  } = useWorkspaceStore();

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showCompletedToast, setShowCompletedToast] = useState(false);
  const [isQuickCheckOpen, setIsQuickCheckOpen] = useState(false);
  const [isFlashcardsOpen, setIsFlashcardsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasMarkedRef = useRef(false);

  // Compile sentences from notes content structure for TTS highlighting sync
  useEffect(() => {
    if (!generatedContent) return;

    const textBlocks: string[] = [
      generatedContent.title || '',
      generatedContent.introduction || '',
      ...(generatedContent.contentBlocks || []).flatMap((b: any) => [
        b.heading || '',
        b.content || ''
      ]),
      generatedContent.summary || '',
    ];

    const compiledSentences = textBlocks
      .flatMap((block) => block.match(/[^.!?]+[.!?]+(\s|$)/g) || [block])
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    sentenceRef.current = compiledSentences;
  }, [generatedContent, currentDay]);

  // Reset scroll + completion guard immediately when the day changes (before
  // content even loads), so there is no flash of the old scroll position.
  useEffect(() => {
    hasMarkedRef.current = false;
    setShowCompletedToast(false);
    if (scrollRef.current) {
      // Use scroll({ behavior: 'instant' }) to bypass any global
      // `scroll-behavior: smooth` CSS that would fight a direct scrollTop=0.
      scrollRef.current.scroll({ top: 0, behavior: 'instant' });
    }
  }, [currentDay?.id]);

  // Also scroll to top whenever new content arrives (e.g. after generation or
  // loading from history) so the user always starts reading from the beginning.
  useEffect(() => {
    if (!generatedContent) return;
    hasMarkedRef.current = false;
    setShowCompletedToast(false);
    if (scrollRef.current) {
      scrollRef.current.scroll({ top: 0, behavior: 'instant' });
    }
  }, [generatedContent]);

  // Scroll-to-bottom completion detector
  const handleScroll = useCallback(() => {
    if (hasMarkedRef.current || !currentDay?.id || !generatedContent) return;
    const el = scrollRef.current;
    if (!el) return;
    const scrolled = el.scrollTop + el.clientHeight;
    const total = el.scrollHeight;
    if (total <= el.clientHeight) return; // content fits without scrolling — skip
    if (scrolled / total >= 0.9) {
      hasMarkedRef.current = true;
      markDayCompleted(currentDay.id);
      setShowCompletedToast(true);
      triggerConfetti();
      setTimeout(() => setShowCompletedToast(false), 3500);
    }
  }, [currentDay?.id, generatedContent, markDayCompleted]);

  const triggerConfetti = () => {
    confetti({
      particleCount: 50,
      spread: 45,
      origin: { y: 0.8 },
      colors: ['#2563EB', '#F59E0B', '#10B981'],
    });
  };

  const isDayCompleted = currentDay?.id ? completedDays.has(currentDay.id) : false;

  // Explicit "Mark Day as Complete" action. Runs the same persistence +
  // celebration path as the scroll-to-bottom auto-detector, but as a deliberate
  // click so a user who skims (or whose notes fit on one screen) can still
  // complete the day and, on the final day, trigger the course badge.
  const handleMarkComplete = () => {
    if (!currentDay?.id || completedDays.has(currentDay.id)) return;
    hasMarkedRef.current = true;
    markDayCompleted(currentDay.id);
    setShowCompletedToast(true);
    triggerConfetti();
    setTimeout(() => setShowCompletedToast(false), 3500);
  };

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    triggerConfetti();
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const [isPdfExporting, setIsPdfExporting] = useState(false);

  const handleDownloadPdf = async () => {
    if (!generatedContent || isPdfExporting) return;
    setIsPdfExporting(true);
    try {
      await exportNotesPdf({
        content: generatedContent,
        topicTitle: generatedContent?.title || currentDay?.title || 'Study Notes',
        dayNumber: currentDay?.dayNumber ?? 1,
        difficulty: generatedContent?.difficulty || 'Intermediate',
      });
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsPdfExporting(false);
    }
  };

  const renderParagraphWithHighlights = (paragraphText: string) => {
    if (!paragraphText) return null;

    // Split into sentences using punctuation lookahead
    const sentences = paragraphText.match(/[^.!?]+[.!?]+(\s|$)/g) || [paragraphText];

    return sentences.map((sentence, idx) => {
      const trimmed = sentence.trim();
      if (!trimmed) return null;

      const sentencesList = sentenceRef.current;
      const globalIdx = sentencesList.findIndex(
        (s) => s.toLowerCase().includes(trimmed.toLowerCase()) || trimmed.toLowerCase().includes(s.toLowerCase())
      );
      const isActive = activeSentenceIndex === globalIdx;

      const handleSentenceClick = () => {
        if (globalIdx !== -1) {
          setActiveSentenceIndex(globalIdx);
          setPlaying(true);
        }
      };

      return (
        <span
          key={idx}
          onClick={handleSentenceClick}
          className={`karaoke-span cursor-pointer rounded px-0.5 transition-colors duration-150 ${isActive
              ? 'bg-blue-100 text-blue-800 border-b border-blue-400 font-medium'
              : 'hover:bg-slate-100 hover:text-slate-900 text-slate-700'
            }`}
        >
          {sentence}
        </span>
      );
    });
  };

  if (isLoadingContent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500">
        <RefreshCw className="h-10 w-10 animate-spin text-blue-600 mb-4" />
        <p className="text-sm font-medium tracking-wide">Synthesizing Comprehensive Study Notes & RAG Data...</p>
      </div>
    );
  }

  if (!generatedContent) {
    // Check if this day already has content in the roadmap data (loading in progress)
    const dayHasExistingContent = (currentDay as any)?.topics?.length > 0;

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
        {dayHasExistingContent ? (
          // Content exists in DB — fetchNotesHistory is loading it
          <>
            <RefreshCw className="h-12 w-12 text-blue-600 mb-4 animate-spin" />
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Loading Your Study Notes...</h2>
            <p className="text-slate-500 max-w-sm text-sm leading-relaxed">Restoring your previously generated content for this day.</p>
          </>
        ) : (
          // No content ever generated for this day
          <>
            <BookOpen className="h-16 w-16 text-slate-300 mb-4 animate-pulse" />
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Ready to Study Day {currentDay?.dayNumber}?</h2>
            <p className="text-slate-500 max-w-sm mb-6 leading-relaxed">
              No notes generated yet for this day. Click below to generate premium AI-powered study content — it will be saved and reloaded instantly next time.
            </p>
            <button
              onClick={onTriggerGenerate}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold tracking-[0.01em] shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-95 transition-all cursor-pointer"
            >
              Generate Study Notes
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      key={currentDay?.id}
      ref={scrollRef}
      onScroll={handleScroll}
      className={`flex-1 min-h-0 p-8 overflow-y-auto pb-24 bg-white print:h-auto print:overflow-visible print:bg-white print:p-0 ${focusMode ? 'focus-active' : ''}`}
    >
      <div className="printable-notes max-w-3xl mx-auto space-y-8 animate-fade-in print:max-w-none print:p-8">

        {/* Day-complete toast */}
        <div
          className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-full bg-emerald-600 text-white text-sm font-semibold shadow-xl shadow-emerald-600/30 transition-all duration-500 pointer-events-none ${showCompletedToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
        >
          <CheckCircle2 className="h-5 w-5" />
          Day {currentDay?.dayNumber} Complete!
        </div>

        {/* Header Section */}
        <div className="border-b border-slate-100 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 bg-amber-50 border border-amber-100 rounded-md text-xs font-medium text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Study Notes
              </span>
              <span className="px-2.5 py-1 bg-blue-50 border border-blue-100 rounded-md text-xs font-medium text-blue-700 uppercase tracking-wider">
                {generatedContent.difficulty || 'Intermediate'}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 mt-3 leading-tight tracking-[-0.02em]">
              {generatedContent.title}
            </h1>
          </div>

          {/* Version Switcher & Regeneration actions — hidden when printing */}
          <div className="print:hidden flex items-center space-x-2.5 self-end md:self-center">
            <button
              onClick={handleMarkComplete}
              disabled={isDayCompleted}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isDayCompleted
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 cursor-default'
                  : 'bg-emerald-600 border border-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm'
              }`}
              title={isDayCompleted ? 'You have completed this day' : 'Mark this day as complete'}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isDayCompleted ? 'Day Completed' : 'Mark Complete'}</span>
            </button>

            {notesHistory.length > 0 && (
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-medium text-slate-600 uppercase tracking-wider">Version:</span>
                <select
                  value={activeVersionId || ''}
                  onChange={(e) => setActiveVersion(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-500 transition-colors"
                >
                  {notesHistory.map((item, idx) => (
                    <option key={item.id} value={item.id}>
                      V{notesHistory.length - idx} ({new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleDownloadPdf}
              disabled={isPdfExporting}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Download as PDF"
            >
              {isPdfExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span>{isPdfExporting ? 'Exporting...' : 'PDF'}</span>
            </button>

            <button
              onClick={() => setIsFlashcardsOpen(true)}
              disabled={!activeVersionId}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Review Flashcards"
            >
              <Brain className="h-3.5 w-3.5" />
              <span>Flashcards</span>
            </button>

            <button
              onClick={() => setIsQuickCheckOpen(true)}
              disabled={!activeVersionId}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-500 text-amber-700 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Quick Check Micro-assessment"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Quick Check</span>
            </button>

            <div className="flex flex-col items-center gap-0.5 ml-2">
              <span className="text-[10px] text-slate-400 font-medium">Confuse?</span>
              <button
                onClick={onTriggerGenerate}
                disabled={isLoadingContent}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                title="Confused? Regenerate and refine your notes"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingContent ? 'animate-spin' : ''}`} />
                <span>Refine Notes</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Body */}
        {generatedContent.script ? (
          <div className="pt-4 pb-20">
            <PodcastPlayer
              topicId={generatedContent.topicId || currentDay?.id || 'demo'}
              script={generatedContent.script}
              audioUrl={generatedContent.audioUrl}
            />
          </div>
        ) : (
          <>
            {/* Introduction */}
            <div className="p-8 bg-blue-50/60 border border-blue-100 rounded-2xl flex gap-6 items-start">
              <div className="p-3 bg-blue-100 rounded-xl text-blue-600 flex-shrink-0">
                <BookOpen className="h-6 w-6" />
              </div>
              <div className="space-y-3 pt-1">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-blue-700">Introduction</h3>
                <p className="text-base leading-relaxed text-slate-700">
                  {renderParagraphWithHighlights(generatedContent.introduction)}
                </p>
              </div>
            </div>

            {/* Outline / Concepts List */}
            {generatedContent.outline && generatedContent.outline.length > 0 && (
              <div className="p-6 bg-transparent border border-slate-100 rounded-2xl space-y-4 mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-600 flex items-center gap-2">
                  <List className="h-5 w-5 text-blue-600" />
                  Core Concepts Covered
                </h3>
                <div className="grid md:grid-cols-2 gap-4 pt-2">
                  {generatedContent.outline.map((item: string, idx: number) => (
                    <div key={idx} className="flex items-center space-x-4 p-4 bg-slate-50 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors">
                      <span className="h-7 w-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-mono font-bold">{idx + 1}</span>
                      <span className="text-sm font-medium text-slate-900">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visual Concept Map / Diagram */}
            {generatedContent.visualDiagram && (
              <Mermaid chart={generatedContent.visualDiagram} />
            )}

            {/* Core Lesson Content Blocks */}
            <div className="space-y-12 pt-8">
              {(generatedContent.contentBlocks || []).map((block: any, idx: number) => (
                <div key={idx} className="space-y-5 group">
                  <div className="flex items-center space-x-3">
                    <div className="h-2 w-2 rounded-full bg-blue-600 group-hover:scale-125 transition-transform"></div>
                    <h2 className="text-2xl font-bold tracking-[-0.01em] text-slate-900">
                      {block.heading}
                    </h2>
                  </div>

                  <div className="text-[17px] leading-relaxed text-slate-700 space-y-5 pl-5">
                    {(block.content || '').split('\n\n').map((paragraph: string, pIdx: number) => (
                      <p key={pIdx}>
                        {renderParagraphWithHighlights(paragraph)}
                      </p>
                    ))}
                  </div>

                  {/* Optional Code Example Code Editor block — kept dark
                  intentionally: a dark code editor reads as intentional
                  IDE chrome even inside an otherwise light document (the
                  same convention most docs sites use for code blocks). */}
                  {block.codeExample && (
                    <div className="ml-5 rounded-xl border border-slate-200 bg-[#1A1A1A] overflow-hidden mt-4 shadow-sm">
                      {/* IDE header */}
                      <div className="bg-[#121824] px-4 py-2.5 flex items-center justify-between border-b border-slate-800/50">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                          <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                          <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                          <span className="text-xs font-mono text-slate-500 pl-2 flex items-center gap-1.5">
                            <Code className="h-3.5 w-3.5 text-blue-400" />
                            snippet.{block.language || 'code'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopyCode(block.codeExample, idx)}
                          className="print:hidden flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/50 rounded-md text-xs font-medium tracking-wide transition-all cursor-pointer"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-semibold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy Code</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="bg-[#0b0f19] p-5 overflow-x-auto font-mono text-xs leading-relaxed text-blue-200 selection:bg-blue-500/30">
                        <code>{block.codeExample}</code>
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Conclusion / Summary */}
            <div className="p-6 bg-gradient-to-br from-amber-50 to-white border border-amber-100 rounded-2xl flex gap-4 items-start shadow-sm pt-6 mt-8">
              <div className="p-3 bg-amber-100 border border-amber-200 rounded-xl text-amber-600 flex-shrink-0">
                <Lightbulb className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-600">Summary & Takeaways</h3>
                <p className="text-sm leading-relaxed text-slate-700">
                  {renderParagraphWithHighlights(generatedContent.summary)}
                </p>
              </div>
            </div>

            {/* Sources & Citations */}
            {generatedContent.sources && generatedContent.sources.length > 0 && (
              <div className="border-t border-slate-100 pt-6">
                <h4 className="text-xs font-medium text-slate-600 uppercase tracking-widest mb-3">References & RAG Sources</h4>
                <div className="space-y-2">
                  {generatedContent.sources.map((src: any, idx: number) => (
                    <div key={idx} className="flex items-center space-x-2 text-xs">
                      <span className="text-slate-400 font-mono">[{idx + 1}]</span>
                      <span className="text-slate-600 font-medium">{src.label}:</span>
                      {src.url ? (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline transition-all"
                        >
                          <span>{src.url}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500 italic">No URL provided</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {activeVersionId && (
        <QuickCheckModal 
          topicId={activeVersionId} 
          isOpen={isQuickCheckOpen} 
          onClose={() => setIsQuickCheckOpen(false)} 
        />
      )}
      
      {activeVersionId && (
        <FlashcardsModal 
          topicId={activeVersionId} 
          isOpen={isFlashcardsOpen} 
          onClose={() => setIsFlashcardsOpen(false)} 
        />
      )}
    </div>
  );
};

export default LivingDocument;
