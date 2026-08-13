import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Sparkles, Send, RefreshCw } from 'lucide-react';
import api from '@/lib/axiosConfig';
import { redirectToApp, appForIntent } from '@/lib/ssoHandoff';

const APP_LABELS: Record<'mentor' | 'career' | 'quiz', string> = {
  mentor: 'EdMentor',
  career: 'EdCompass',
  quiz: 'EdQuiz',
};

export const InteractiveAssistant: React.FC = () => {
  const { currentDay, token } = useWorkspaceStore();
  const [chatType, setChatType] = useState<'focused' | 'cross'>('focused');

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Seed the assistant with a fresh greeting whenever the active day changes.
  useEffect(() => {
    if (!currentDay) return;
    setChatMessages([
      {
        role: 'assistant',
        content: `Hi! I am your companion for "${currentDay.title}". Ask me any questions about this topic and I'll help you out.`,
      },
    ]);
  }, [currentDay]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || !currentDay) return;
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsSendingChat(true);

    try {
      // Intent routing: classify before doing anything else. If the student
      // is really asking for a mentor, career guidance, or a quiz, this is
      // not a "learn" question — hand off to the matching sibling app
      // (Person 1's /api/sso/handoff) instead of answering it here.
      let intent: 'learn' | 'mentor' | 'career' | 'quiz' = 'learn';
      try {
        const classifyRes = await api.post('/api/assistant/classify', { message: userMsg });
        if (classifyRes.data?.success && classifyRes.data?.label) {
          intent = classifyRes.data.label;
        }
      } catch (classifyErr) {
        // If classification itself fails, don't block the tutor — just
        // treat the message as a normal learning question.
        console.error('Intent classification failed, defaulting to learn:', classifyErr);
      }

      if (intent !== 'learn') {
        const appLabel = APP_LABELS[intent];
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `That sounds like a ${appLabel} question — taking you there now, you'll stay signed in.` },
        ]);

        // Quiz handoffs carry the current topic automatically so the user
        // never has to re-type or re-select what they're studying.
        const topic = intent === 'quiz' ? currentDay.title : undefined;
        const ok = await redirectToApp(appForIntent(intent), topic);

        if (!ok) {
          setChatMessages((prev) => [
            ...prev,
            { role: 'assistant', content: `Couldn't reach ${appLabel} right now — please try again in a moment.` },
          ]);
        }
        // On success, window.location.href navigation is already underway;
        // the outer finally below still re-enables the input, which is
        // harmless since the browser is about to leave this page anyway.
        return;
      }

      const systemPrompt = chatType === 'focused'
        ? `You are an expert tutor. Answer questions about "${currentDay.title}" strictly using verified resources. Remain brief and technical.`
        : `You are an expert tutor. Answer questions about "${currentDay.title}" by connecting it to unrelated domains (e.g. cooking, space, sports) through creative analogies.`;

      // Call route
      const response = await api.post('/api/generate', {
        topic: currentDay.title,
        mode: 1, // trigger basic QA
        difficulty: 'Intermediate',
        url: '', // Rely on wiki search
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Simple mock fallback to prevent rate limits
      const tutorReply = response.data.success
        ? `Based on search context: ${response.data.data.keystoneConcepts?.[0]?.description || 'Verified concept detail.'}`
        : 'Connecting resources...';

      setChatMessages((prev) => [...prev, { role: 'assistant', content: tutorReply }]);
    } catch (err) {
      console.error(err);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Connection timed out. Please verify API settings.' }]);
    } finally {
      setIsSendingChat(false);
    }
  };

  return (
    <aside className="print:hidden w-full h-full bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 py-3 px-4 text-xs font-semibold uppercase tracking-wider text-blue-600">
        <Sparkles className="h-4 w-4" />
        <span>AI Tutor</span>
      </div>

      {/* AI Tutor Chat */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden">
        {/* Chat options */}
        <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <span className="text-xs font-medium text-slate-600">Context Mode:</span>
          <div className="flex space-x-1">
            <button
              onClick={() => setChatType('focused')}
              className={`px-2 py-1 text-xs rounded transition-colors ${chatType === 'focused' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                }`}
            >
              Focused
            </button>
            <button
              onClick={() => setChatType('cross')}
              className={`px-2 py-1 text-xs rounded transition-colors ${chatType === 'cross' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                }`}
            >
              Cross-Domain
            </button>
          </div>
        </div>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-2.5 max-w-[280px] rounded-lg text-xs leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 border border-slate-200 text-slate-800'
                }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isSendingChat && (
            <div className="flex justify-start">
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-center space-x-1.5">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input control */}
        <div className="p-3 border-t border-slate-100 flex items-center space-x-2 bg-slate-50">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            placeholder="Ask a clarifying question..."
            className="flex-1 bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSendChat}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
export default InteractiveAssistant;
