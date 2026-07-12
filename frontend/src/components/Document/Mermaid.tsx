'use client';

import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { AlertCircle, Eye } from 'lucide-react';

interface MermaidProps {
  chart: string;
}

export const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Generate a unique ID for the SVG rendering
  const [id] = useState(() => `mermaid-svg-${Math.floor(Math.random() * 1000000)}`);

  useEffect(() => {
    let isMounted = true;
    setError(null);
    setShowRaw(false);

    if (!chart || typeof window === 'undefined') return;

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
        },
      });

      // Clear previous rendering
      if (containerRef.current) {
        containerRef.current.innerHTML = `<div class="animate-pulse text-slate-500 text-xs">Parsing diagram...</div>`;
      }

      // Sanitize the chart string to fix typical AI syntax hallucinations (e.g. arrows inside label blocks like "-->|label|>")
      const sanitizedChart = chart
        .replace(/\|([^|]*)\|\s*>/g, '|$1|')
        .replace(/\|([^|]*)\|\s*-\s*>/g, '|$1|')
        .trim();

      // Try to render the diagram code
      mermaid.render(id, sanitizedChart)
        .then((res) => {
          if (isMounted && containerRef.current) {
            containerRef.current.innerHTML = res.svg;
            if (res.bindFunctions) {
              res.bindFunctions(containerRef.current);
            }
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error('Mermaid render error:', err);
            setError('Failed to parse visual flowchart syntax.');
          }
        });
    } catch (err: any) {
      if (isMounted) {
        console.error('Mermaid init error:', err);
        setError(err.message || 'Failed to initialize diagram parser.');
      }
    }

    return () => {
      isMounted = false;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div className="bg-slate-900/40 border border-amber-500/10 rounded-2xl p-5 space-y-3">
        <div className="flex items-center space-x-2 text-amber-500">
          <AlertCircle className="h-4.5 w-4.5 flex-shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Visual Flowchart Failed</span>
        </div>
        <p className="text-xs text-slate-400">
          The generated RAG visual diagram contains structure syntax issues. You can preview the raw flowchart instructions below.
        </p>
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>{showRaw ? 'Hide Raw Flowchart' : 'Show Raw Flowchart'}</span>
        </button>
        {showRaw && (
          <pre className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-[10px] font-mono text-indigo-300 overflow-x-auto select-all">
            {chart}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col items-center">
      <div className="w-full text-left pb-4 border-b border-slate-800/40 mb-4 flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Visual Concept Map</span>
        <span className="text-[10px] bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 font-semibold px-2 py-0.5 rounded">Flowchart</span>
      </div>
      <div 
        ref={containerRef} 
        className="mermaid-container w-full overflow-x-auto flex justify-center py-2 select-none" 
      />
    </div>
  );
};

export default Mermaid;
