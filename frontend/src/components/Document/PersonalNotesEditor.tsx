'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Edit3, Save, Check, Bold, Code, List, Heading, RefreshCw } from 'lucide-react';
import axios from 'axios';

interface PersonalNotesEditorProps {
  dayId: string;
  topicTitle: string;
}

export default function PersonalNotesEditor({ dayId, topicTitle }: PersonalNotesEditorProps) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load existing note on day change
  useEffect(() => {
    let isMounted = true;
    const fetchNote = async () => {
      setIsLoading(true);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('edlearn_token') : null;
        const res = await axios.get(`/api/notes/${dayId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (isMounted && res.data?.success) {
          setContent(res.data.note?.content || '');
          if (res.data.note?.updatedAt) {
            setLastSavedTime(new Date(res.data.note.updatedAt).toLocaleTimeString());
          }
          setSaveStatus('saved');
        }
      } catch (err) {
        console.error('Failed to load note:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchNote();
    return () => {
      isMounted = false;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [dayId]);

  // Debounced auto-save
  const handleContentChange = (newVal: string) => {
    setContent(newVal);
    setSaveStatus('unsaved');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('edlearn_token') : null;
        const res = await axios.put(
          `/api/notes/${dayId}`,
          { content: newVal },
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        if (res.data?.success) {
          setSaveStatus('saved');
          setLastSavedTime(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.error('Auto-save error:', err);
        setSaveStatus('unsaved');
      }
    }, 1200);
  };

  const insertFormatting = (prefix: string, suffix: string = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;
    const newContent = content.substring(0, start) + replacement + content.substring(end);
    handleContentChange(newContent);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + (selected.length || 4));
    }, 50);
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        <span className="text-xs font-medium">Loading personal notes...</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col h-full min-h-[500px]">
      {/* Header & Status */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
            <Edit3 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Personal Notes & Reflections</h3>
            <p className="text-[11px] text-slate-500">
              {topicTitle}
            </p>
          </div>
        </div>

        {/* Auto-save status */}
        <div className="flex items-center gap-2 text-xs font-medium">
          {saveStatus === 'saving' && (
            <span className="text-amber-600 flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Saving...</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-emerald-600 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" />
              <span>Saved {lastSavedTime ? `at ${lastSavedTime}` : ''}</span>
            </span>
          )}
          {saveStatus === 'unsaved' && (
            <span className="text-slate-400 flex items-center gap-1">
              <span>Unsaved changes</span>
            </span>
          )}
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center gap-1 text-slate-500">
        <button
          onClick={() => insertFormatting('### ')}
          title="Heading"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <Heading className="h-4 w-4" />
        </button>
        <button
          onClick={() => insertFormatting('**', '**')}
          title="Bold"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          onClick={() => insertFormatting('```\n', '\n```')}
          title="Code Block"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <Code className="h-4 w-4" />
        </button>
        <button
          onClick={() => insertFormatting('- ')}
          title="Bullet List"
          className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <List className="h-4 w-4" />
        </button>
      </div>

      {/* Textarea */}
      <div className="flex-1 p-4">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Type your personal insights, code snippets, takeaways, or questions here. Notes auto-save automatically as you type..."
          className="w-full h-full min-h-[380px] p-2 bg-transparent text-slate-800 placeholder-slate-400 text-sm leading-relaxed focus:outline-none resize-none font-mono"
        />
      </div>
    </div>
  );
}
