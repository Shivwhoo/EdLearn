import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { MessageSquare, Users, Sparkles, Send, RefreshCw, ThumbsUp, HelpCircle } from 'lucide-react';
import api from '@/lib/axiosConfig';
import { redirectToApp, appForIntent } from '@/lib/ssoHandoff';

const APP_LABELS: Record<'mentor' | 'career' | 'quiz', string> = {
  mentor: 'EdMentor',
  career: 'EdCompass',
  quiz: 'EdQuiz',
};

export const InteractiveAssistant: React.FC = () => {
  const { currentDay, activeMode, user } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState<'chat' | 'forum'>('chat');
  const [chatType, setChatType] = useState<'focused' | 'cross'>('focused');

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Forum state
  const [threads, setThreads] = useState<any[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadContent, setNewThreadContent] = useState('');
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({});

  // Sync / fetch forum threads from MongoDB when day changes
  useEffect(() => {
    if (!currentDay) return;
    fetchForumThreads();
    setChatMessages([
      {
        role: 'assistant',
        content: `Hi! I am your companion for "${currentDay.title}". Ask me any questions, or switch to the Doubt Forum to collaborate with other learners.`,
      },
    ]);
  }, [currentDay]);

  const fetchForumThreads = async () => {
    if (!currentDay) return;
    setIsLoadingThreads(true);
    try {
      const response = await api.get(`/api/doubt?topicId=${currentDay.id}`);
      setThreads(response.data.threads || []);
    } catch (e) {
      console.error('Fetch threads failed:', e);
    } finally {
      setIsLoadingThreads(false);
    }
  };

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

  const handleCreateThread = async () => {
    if (!newThreadTitle.trim() || !newThreadContent.trim() || !currentDay) return;
    try {
      await api.post('/api/doubt', {
        action: 'createThread',
        topicId: currentDay.id,
        title: newThreadTitle,
        content: newThreadContent,
        // authorName comes from the JWT on the backend; send display name as hint
        authorName: user?.fullName || 'Student',
      });
      setNewThreadTitle('');
      setNewThreadContent('');
      fetchForumThreads();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateComment = async (threadId: string) => {
    const commentContent = commentInputs[threadId];
    if (!commentContent || !commentContent.trim()) return;

    try {
      await api.post('/api/doubt', {
        action: 'createComment',
        threadId,
        content: commentContent,
        authorName: user?.fullName || 'Student',
      });
      setCommentInputs({ ...commentInputs, [threadId]: '' });
      fetchForumThreads();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpvote = async (threadId: string) => {
    try {
      await api.post('/api/doubt', {
        action: 'upvoteThread',
        threadId,
        // userId is read from JWT on the backend; no need to send it
      });
      fetchForumThreads();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <aside className="print:hidden w-full h-full bg-white flex flex-col">
      {/* Sidebar Tabs */}
      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-center text-xs font-semibold uppercase tracking-wider flex items-center justify-center space-x-1.5 border-b-2 ${
            activeTab === 'chat' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>AI Tutor</span>
        </button>
        <button
          onClick={() => setActiveTab('forum')}
          className={`flex-1 py-3 text-center text-xs font-semibold uppercase tracking-wider flex items-center justify-center space-x-1.5 border-b-2 ${
            activeTab === 'forum' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Doubt Forum</span>
        </button>
      </div>

      {/* Tab Contents: AI Tutor Chat */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Chat options */}
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <span className="text-xs font-medium text-slate-600">Context Mode:</span>
            <div className="flex space-x-1">
              <button
                onClick={() => setChatType('focused')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  chatType === 'focused' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                }`}
              >
                Focused
              </button>
              <button
                onClick={() => setChatType('cross')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  chatType === 'cross' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 hover:text-slate-800'
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
                <div className={`p-2.5 max-w-[280px] rounded-lg text-xs leading-relaxed ${
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 border border-slate-200 text-slate-800'
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
      )}

      {/* Tab Contents: Doubt Forum */}
      {activeTab === 'forum' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-4 space-y-4">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* Create Thread Form */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <h4 className="text-xs font-semibold text-slate-700">Ask a Community Doubt:</h4>
              <input
                type="text"
                placeholder="Topic / Title..."
                value={newThreadTitle}
                onChange={(e) => setNewThreadTitle(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-900 outline-none focus:border-blue-500"
              />
              <textarea
                placeholder="Describe your question details..."
                value={newThreadContent}
                onChange={(e) => setNewThreadContent(e.target.value)}
                rows={2}
                className="w-full bg-white border border-slate-200 rounded p-2 text-xs text-slate-900 outline-none focus:border-blue-500 resize-none"
              />
              <button
                onClick={handleCreateThread}
                className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold tracking-[0.01em] transition-all"
              >
                Post Doubt
              </button>
            </div>

            {/* List existing threads */}
            {isLoadingThreads ? (
              <div className="text-center text-xs text-slate-500 py-8">
                <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-blue-600" />
                <span>Loading Community Discussions...</span>
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-8">
                <HelpCircle className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                <span>No threads posted yet. Be the first to ask!</span>
              </div>
            ) : (
              threads.map((thread) => (
                <div key={thread._id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                  <div>
                    <h5 className="font-semibold text-slate-800 text-xs">{thread.title}</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">{thread.content}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                      <div className="flex flex-col space-y-0.5">
                        <span className="font-medium">{thread.author.name}</span>
                        {thread.author.rank && (
                          <span className="text-[10px] text-amber-600 font-medium">Rank: {thread.author.rank}</span>
                        )}
                        {thread.author.badges && thread.author.badges.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {thread.author.badges.map((b: string, i: number) => (
                              <span key={i} className="px-1.5 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded text-[10px]">
                                {b}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleUpvote(thread._id)}
                        className="flex items-center space-x-1 hover:text-amber-600 transition-colors"
                      >
                        <ThumbsUp className="h-3 w-3" />
                        <span>{thread.upvotes?.length || 0}</span>
                      </button>
                    </div>
                  </div>

                  {/* Comment list */}
                  {thread.comments?.length > 0 && (
                    <div className="border-t border-slate-200 pt-2 space-y-1.5">
                      {thread.comments.map((comment: any) => (
                        <div key={comment.commentId} className="bg-white border border-slate-100 p-2 rounded text-[11px] text-slate-700 space-y-1">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-0.5 mb-1">
                            <span className="font-medium text-blue-600">{comment.author.name}</span>
                            {comment.author.rank && (
                              <span className="text-[10px] text-amber-600">{comment.author.rank}</span>
                            )}
                          </div>
                          <p className="text-slate-700 text-[11px] leading-relaxed">{comment.content}</p>
                          {comment.author.badges && comment.author.badges.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {comment.author.badges.map((b: string, i: number) => (
                                <span key={i} className="px-1.5 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded text-[10px]">
                                  {b}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comment Input */}
                  <div className="flex space-x-1.5">
                    <input
                      type="text"
                      placeholder="Reply..."
                      value={commentInputs[thread._id] || ''}
                      onChange={(e) => setCommentInputs({ ...commentInputs, [thread._id]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateComment(thread._id)}
                      className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => handleCreateComment(thread._id)}
                      className="px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Post
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
export default InteractiveAssistant;
