'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';
import { ArrowLeft, Send, Trash2, Edit2, Users, MessageSquare, PenTool } from 'lucide-react';

type Question = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  authorId: string;
  author: { profile: { fullName: string }; email: string };
  answers: Answer[];
};

type Answer = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  author: { profile: { fullName: string }; email: string };
};

export default function StudyRoomPage() {
  const { roomId } = useParams() as { roomId: string };
  const router = useRouter();
  const { token, userProfile, user } = useWorkspaceStore();
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [participants, setParticipants] = useState<Array<{userId: string, email: string}>>([]);
  
  const [activeTab, setActiveTab] = useState<'whiteboard' | 'qa'>('whiteboard');
  
  // Whiteboard State
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  
  // Q&A State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestionTitle, setNewQuestionTitle] = useState('');
  const [newQuestionBody, setNewQuestionBody] = useState('');
  const [answerBodies, setAnswerBodies] = useState<{[qId: string]: string}>({});

  useEffect(() => {
    if (!token) return;

    // Connect to Socket
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
    const newSocket = io(backendUrl, {
      auth: { token },
      transports: ['websocket']
    });

    newSocket.on('connect', () => {
      newSocket.emit('join_room', roomId);
    });

    newSocket.on('user_joined', (data) => {
      setParticipants(prev => {
        if (prev.find(p => p.userId === data.userId)) return prev;
        return [...prev, data];
      });
    });

    newSocket.on('user_left', (data) => {
      setParticipants(prev => prev.filter(p => p.userId !== data.userId));
    });

    // Whiteboard Sync Events
    newSocket.on('draw', (drawData) => {
      // In a real app we'd load paths incrementally. 
      // With react-sketch-canvas, we can load full state.
      if (canvasRef.current && drawData) {
        canvasRef.current.loadPaths(drawData);
      }
    });
    
    newSocket.on('clear_whiteboard', () => {
      if (canvasRef.current) {
        canvasRef.current.clearCanvas();
      }
    });

    setSocket(newSocket);
    
    return () => {
      newSocket.emit('leave_room', roomId);
      newSocket.disconnect();
    };
  }, [roomId, token]);

  useEffect(() => {
    if (token) fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, roomId]);

  const fetchQuestions = async () => {
    try {
      const res = await axios.get(`/api/study-rooms/${roomId}/questions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setQuestions(res.data.questions);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionTitle || !newQuestionBody) return;
    try {
      const res = await axios.post(`/api/study-rooms/${roomId}/questions`, 
        { title: newQuestionTitle, body: newQuestionBody },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setQuestions([res.data.question, ...questions]);
        setNewQuestionTitle('');
        setNewQuestionBody('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostAnswer = async (qId: string) => {
    const body = answerBodies[qId];
    if (!body) return;
    try {
      const res = await axios.post(`/api/study-rooms/questions/${qId}/answers`, 
        { body },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setQuestions(questions.map(q => {
          if (q.id === qId) {
            return { ...q, answers: [...q.answers, res.data.answer] };
          }
          return q;
        }));
        setAnswerBodies({ ...answerBodies, [qId]: '' });
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  const handleDeleteQuestion = async (qId: string) => {
    try {
      await axios.delete(`/api/study-rooms/questions/${qId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuestions(questions.filter(q => q.id !== qId));
    } catch (err) {
      console.error(err);
    }
  };
  
  const handleDeleteAnswer = async (qId: string, aId: string) => {
    try {
      await axios.delete(`/api/study-rooms/answers/${aId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuestions(questions.map(q => {
        if (q.id === qId) {
          return { ...q, answers: q.answers.filter(a => a.id !== aId) };
        }
        return q;
      }));
    } catch (err) {
      console.error(err);
    }
  };

  // Whiteboard sync logic
  const handleStroke = async () => {
    if (!socket || !canvasRef.current) return;
    const paths = await canvasRef.current.exportPaths();
    socket.emit('draw', { roomId, drawData: paths });
  };
  
  const handleClear = () => {
    if (canvasRef.current) {
      canvasRef.current.clearCanvas();
      socket?.emit('clear_whiteboard', roomId);
    }
  };

  if (!token) return null;

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/study-rooms')}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Study Room
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            <Users className="h-4 w-4" />
            <span className="font-semibold">{participants.length + 1}</span> Online
          </div>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
          <div className="flex items-center gap-1 p-4 bg-white border-b border-slate-200">
            <button 
              onClick={() => setActiveTab('whiteboard')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors ${activeTab === 'whiteboard' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <PenTool className="h-4 w-4" /> Collaborative Whiteboard
            </button>
            <button 
              onClick={() => setActiveTab('qa')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors ${activeTab === 'qa' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <MessageSquare className="h-4 w-4" /> Threaded Q&A
            </button>
          </div>
          
          {activeTab === 'whiteboard' && (
            <div className="flex-1 p-4 flex flex-col">
              <div className="flex justify-end mb-2">
                <button onClick={handleClear} className="text-xs bg-rose-100 text-rose-700 px-3 py-1.5 rounded hover:bg-rose-200 font-semibold transition-colors">
                  Clear Canvas
                </button>
              </div>
              <div className="flex-1 border border-slate-300 rounded-xl overflow-hidden shadow-sm bg-white">
                <ReactSketchCanvas
                  ref={canvasRef}
                  strokeWidth={4}
                  strokeColor="black"
                  onStroke={handleStroke}
                  width="100%"
                  height="100%"
                />
              </div>
            </div>
          )}
          
          {activeTab === 'qa' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <div className="max-w-3xl mx-auto space-y-6">
                
                {/* Ask Question Form */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-semibold text-slate-800 mb-3">Ask a Question</h3>
                  <form onSubmit={handlePostQuestion} className="space-y-3">
                    <input 
                      type="text"
                      placeholder="Question Title"
                      value={newQuestionTitle}
                      onChange={e => setNewQuestionTitle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <textarea 
                      placeholder="Add details..."
                      rows={3}
                      value={newQuestionBody}
                      onChange={e => setNewQuestionBody(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"
                    />
                    <div className="flex justify-end">
                      <button type="submit" className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-semibold hover:bg-blue-700 transition-colors">
                        Post Question
                      </button>
                    </div>
                  </form>
                </div>
                
                {/* Questions List */}
                <div className="space-y-6">
                  {questions.map(q => (
                    <div key={q.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-slate-900 text-lg">{q.title}</h4>
                        {q.authorId === user?.id && (
                          <button onClick={() => handleDeleteQuestion(q.id)} className="text-slate-400 hover:text-rose-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-slate-700 text-sm mb-3">{q.body}</p>
                      <div className="text-xs text-slate-500 mb-4 pb-4 border-b border-slate-100">
                        Asked by {q.author.profile?.fullName || q.author.email} on {new Date(q.createdAt).toLocaleString()}
                      </div>
                      
                      {/* Answers */}
                      <div className="space-y-3 pl-4 border-l-2 border-slate-100 mb-4">
                        {q.answers.map(a => (
                          <div key={a.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="flex justify-between items-start">
                              <p className="text-sm text-slate-800">{a.body}</p>
                              {a.authorId === user?.id && (
                                <button onClick={() => handleDeleteAnswer(q.id, a.id)} className="text-slate-400 hover:text-rose-600 ml-2">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-2">
                              {a.author.profile?.fullName || a.author.email} &bull; {new Date(a.createdAt).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Post Answer */}
                      <div className="flex items-center gap-2 mt-2">
                        <input 
                          type="text"
                          placeholder="Write an answer..."
                          value={answerBodies[q.id] || ''}
                          onChange={e => setAnswerBodies({...answerBodies, [q.id]: e.target.value})}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 text-sm outline-none focus:border-blue-500"
                        />
                        <button onClick={() => handlePostAnswer(q.id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full">
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {questions.length === 0 && (
                    <div className="text-center p-8 text-slate-500 bg-white border border-slate-200 rounded-xl">
                      No questions yet. Be the first to ask!
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
