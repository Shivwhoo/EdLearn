import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { BookOpen, RefreshCw, Copy, Check, Lightbulb, List, FileText, ExternalLink, Code, Download } from 'lucide-react';
import confetti from 'canvas-confetti';
import Mermaid from './Mermaid';

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
  } = useWorkspaceStore();

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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

  const triggerConfetti = () => {
    confetti({
      particleCount: 50,
      spread: 45,
      origin: { y: 0.8 },
      colors: ['#6366F1', '#F59E0B', '#10B981'],
    });
  };

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    triggerConfetti();
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Downloads/prints the current notes. Deliberately uses the browser's own
  // print pipeline (destination "Save as PDF") rather than a client-side PDF
  // library — no new dependency, and it handles the Mermaid diagram/code
  // blocks correctly since it prints the real rendered DOM. The ".printable-notes"
  // scoping and dark->light color reset live in globals.css; every other
  // panel (nav, chat, audio dock) is hidden for print via Tailwind's
  // `print:hidden` utility where it's rendered.
  const handleDownloadPdf = () => {
    window.print();
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
          className={`karaoke-span cursor-pointer rounded px-0.5 transition-colors duration-150 ${
            isActive 
              ? 'bg-indigo-500/20 text-indigo-200 border-b border-indigo-400 font-medium' 
              : 'hover:bg-slate-800/80 hover:text-slate-100 text-slate-300'
          }`}
        >
          {sentence}
        </span>
      );
    });
  };

  if (isLoadingContent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
        <RefreshCw className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-medium tracking-wide">Synthesizing Comprehensive Study Notes & RAG Data...</p>
      </div>
    );
  }

  if (!generatedContent) {
    // Check if this day already has content in the roadmap data (loading in progress)
    const dayHasExistingContent = (currentDay as any)?.topics?.length > 0;

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0F1117]">
        {dayHasExistingContent ? (
          // Content exists in DB — fetchNotesHistory is loading it
          <>
            <RefreshCw className="h-12 w-12 text-indigo-500 mb-4 animate-spin" />
            <h2 className="text-lg font-bold text-slate-200 mb-2">Loading Your Study Notes...</h2>
            <p className="text-slate-500 max-w-sm text-sm">Restoring your previously generated content for this day.</p>
          </>
        ) : (
          // No content ever generated for this day
          <>
            <BookOpen className="h-16 w-16 text-slate-700 mb-4 animate-pulse" />
            <h2 className="text-xl font-bold text-slate-200 mb-2">Ready to Study Day {currentDay?.dayNumber}?</h2>
            <p className="text-slate-500 max-w-sm mb-6">
              No notes generated yet for this day. Click below to generate premium AI-powered study content — it will be saved and reloaded instantly next time.
            </p>
            <button
              onClick={onTriggerGenerate}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-lg hover:shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
            >
              Generate Study Notes
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`flex-1 p-8 overflow-y-auto h-[calc(100vh-80px)] pb-32 bg-[#0F1117] print:h-auto print:overflow-visible print:bg-white print:p-0 ${focusMode ? 'focus-active' : ''}`}>
      <div className="printable-notes max-w-3xl mx-auto space-y-8 animate-fade-in print:max-w-none print:p-8">

        {/* Header Section */}
        <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Study Notes
              </span>
              <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                {generatedContent.difficulty || 'Intermediate'}
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-100 mt-3 leading-tight tracking-tight">
              {generatedContent.title}
            </h1>
          </div>

          {/* Version Switcher & Regeneration actions — hidden when printing */}
          <div className="print:hidden flex items-center space-x-2.5 self-end md:self-center">
            {notesHistory.length > 0 && (
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Version:</span>
                <select
                  value={activeVersionId || ''}
                  onChange={(e) => setActiveVersion(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500 transition-colors"
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
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800/60 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              title="Download as PDF or print (choose 'Save as PDF' as the destination)"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PDF</span>
            </button>

            <button
              onClick={onTriggerGenerate}
              disabled={isLoadingContent}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/10 border border-indigo-500/30 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Generate a fresh notes version via RAG"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingContent ? 'animate-spin' : ''}`} />
              <span>Re-generate</span>
            </button>
          </div>
        </div>

        {/* Introduction */}
        <div className="p-6 bg-gradient-to-br from-slate-900/80 to-slate-800/30 border border-slate-800/80 rounded-2xl flex gap-4 items-start shadow-sm">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 flex-shrink-0">
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400">Introduction</h3>
            <p className="text-sm leading-relaxed text-slate-300">
              {renderParagraphWithHighlights(generatedContent.introduction)}
            </p>
          </div>
        </div>

        {/* Outline / Concepts List */}
        {generatedContent.outline && generatedContent.outline.length > 0 && (
          <div className="p-5 bg-slate-900/40 border border-slate-800/60 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <List className="h-4 w-4 text-indigo-500" />
              Core Concepts Covered
            </h3>
            <div className="grid md:grid-cols-2 gap-3 pt-1">
              {generatedContent.outline.map((item: string, idx: number) => (
                <div key={idx} className="flex items-center space-x-3 p-3 bg-slate-800/20 border border-slate-700/30 rounded-xl text-slate-300 hover:border-slate-700 transition-colors">
                  <span className="h-6 w-6 bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 rounded-full flex items-center justify-center text-xs font-mono font-bold">{idx + 1}</span>
                  <span className="text-xs font-medium text-slate-300">{item}</span>
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
        <div className="space-y-8 pt-4">
          {(generatedContent.contentBlocks || []).map((block: any, idx: number) => (
            <div key={idx} className="space-y-4 group">
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 rounded-full bg-indigo-500 group-hover:scale-125 transition-transform"></div>
                <h2 className="text-xl font-bold text-slate-200 tracking-tight">
                  {block.heading}
                </h2>
              </div>
              
              <div className="text-sm leading-relaxed text-slate-300 space-y-4 pl-5">
                {(block.content || '').split('\n\n').map((paragraph: string, pIdx: number) => (
                  <p key={pIdx}>
                    {renderParagraphWithHighlights(paragraph)}
                  </p>
                ))}
              </div>

              {/* Optional Code Example Code Editor block */}
              {block.codeExample && (
                <div className="ml-5 rounded-xl border border-slate-800/80 overflow-hidden shadow-xl">
                  {/* IDE header */}
                  <div className="bg-[#121824] px-4 py-2.5 flex items-center justify-between border-b border-slate-800/50">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                      <span className="text-xs font-mono text-slate-500 pl-2 flex items-center gap-1.5">
                        <Code className="h-3.5 w-3.5 text-indigo-400" />
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
                  <pre className="bg-[#0b0f19] p-5 overflow-x-auto font-mono text-xs leading-relaxed text-indigo-200 selection:bg-indigo-500/30">
                    <code>{block.codeExample}</code>
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Conclusion / Summary */}
        <div className="p-6 bg-gradient-to-br from-amber-500/5 to-slate-900/60 border border-amber-500/10 rounded-2xl flex gap-4 items-start shadow-md pt-6 mt-8">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 flex-shrink-0">
            <Lightbulb className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500">Summary & Takeaways</h3>
            <p className="text-sm leading-relaxed text-slate-300">
              {renderParagraphWithHighlights(generatedContent.summary)}
            </p>
          </div>
        </div>

        {/* Sources & Citations */}
        {generatedContent.sources && generatedContent.sources.length > 0 && (
          <div className="border-t border-slate-800/60 pt-6">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">References & RAG Sources</h4>
            <div className="space-y-2">
              {generatedContent.sources.map((src: any, idx: number) => (
                <div key={idx} className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-600 font-mono">[{idx + 1}]</span>
                  <span className="text-slate-400 font-medium">{src.label}:</span>
                  {src.url ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline transition-all"
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

      </div>
    </div>
  );
};

export default LivingDocument;
