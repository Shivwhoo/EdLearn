'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import LeftNavigationPanel from '@/components/Layout/LeftNavigationPanel';
import { Users, Plus, Loader2 } from 'lucide-react';
import axios from 'axios';

type StudyRoom = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  user: {
    profile: { fullName: string };
    email: string;
  };
};

export default function StudyRoomsPage() {
  const router = useRouter();
  const { token, restoringSession } = useWorkspaceStore();
  
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');

  useEffect(() => {
    if (!token && !restoringSession) {
      router.push('/login');
      return;
    }
    
    if (token) {
      fetchRooms();
    }
  }, [token, restoringSession, router]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/study-rooms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setRooms(res.data.rooms);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName) return;
    
    try {
      setIsCreating(true);
      const res = await axios.post('/api/study-rooms', 
        { name: newRoomName, description: newRoomDesc },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        router.push(`/study-rooms/${res.data.room.id}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  if (!token || restoringSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">
      <div className="w-80 h-full bg-white border-r border-slate-200">
        <LeftNavigationPanel />
      </div>

      <div className="flex-1 h-full overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-6 w-6 text-blue-600" />
                Study Rooms
              </h1>
              <p className="text-slate-500 text-sm mt-1">Real-time collaborative workspaces and Q&A.</p>
            </div>
          </div>

          {/* Create Room Form */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4" /> Create a New Room
            </h2>
            <form onSubmit={handleCreateRoom} className="flex gap-4 items-start">
              <div className="flex-1 space-y-3">
                <input 
                  type="text" 
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Room Name (e.g. System Design Prep)" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                  required
                />
                <input 
                  type="text" 
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="Description (Optional)" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <button 
                type="submit" 
                disabled={isCreating}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow transition-all flex items-center gap-2"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </button>
            </form>
          </div>

          {/* Room List */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Available Rooms</h2>
            
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : rooms.length === 0 ? (
              <div className="text-center p-8 text-slate-500 bg-white border border-slate-200 rounded-xl">
                No active study rooms right now. Create one above!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.map(room => (
                  <div key={room.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="font-semibold text-slate-900 text-lg mb-1">{room.name}</h3>
                    {room.description && <p className="text-sm text-slate-600 mb-4 line-clamp-2">{room.description}</p>}
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-4">
                      <span>By {room.user?.profile?.fullName || room.user?.email}</span>
                      <button 
                        onClick={() => router.push(`/study-rooms/${room.id}`)}
                        className="text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        Join Room &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
