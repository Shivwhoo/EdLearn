import { create } from 'zustand';
import axios from 'axios';

export interface UserProfile {
  fullName: string;
  careerGoal: string;
  currentSkills: string[];
  availableTime: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface DayTopic {
  id: string;
  title: string;
  mode: number;
  createdAt: string;
}

export interface Day {
  id: string;
  dayNumber: number;
  title: string;
  duration: number;
  topics?: DayTopic[];
}

export interface Roadmap {
  id: string;
  title: string;
  isAchievable: boolean;
  deadline?: string;
  days: Day[];
}

export interface UserSession {
  id: string;
  email: string;
  fullName: string;
}

export interface WorkspaceState {
  // Auth State
  token: string | null;
  user: UserSession | null;
  
  // User Onboarding and Roadmap Data
  userProfile: UserProfile | null;
  roadmap: Roadmap | null;
  currentDay: Day | null;
  currentTopicTitle: string;
  currentTopicId: string | null;
  
  // Pedagogical Model generation state
  activeMode: number; // 1 to 7
  generatedContent: any | null; 
  isLoadingContent: boolean;
  
  // Mode 2: Socratic tracking parameters
  socraticRetryCount: number;
  socraticAnsweredCorrectly: boolean | null;
  socraticAttempts: string[];
  
  // Mode 3: Simplifier Keystone lock parameters
  simplifierUnlocked: boolean;
  simplifierAnswers: { [key: number]: number }; // questionId -> optionIndex
  
  // Bottom dock Audio & Highlighting parameters
  isPlaying: boolean;
  activeSentenceIndex: number;
  speechRate: number;
  speechPitch: number;
  focusMode: boolean;

  // History & Versioning parameters
  notesHistory: any[];
  activeVersionId: string | null;
  restoringSession: boolean;

  // Actions
  login: (token: string, user: UserSession) => void;
  logout: () => void;
  fetchCurrentUser: () => Promise<void>;
  setUserProfile: (profile: UserProfile) => void;
  setRoadmap: (roadmap: Roadmap) => void;
  selectDay: (day: Day) => void;
  setTopicTitle: (title: string) => void;
  setActiveMode: (mode: number) => void;
  setGeneratedContent: (content: any) => void;
  setLoadingContent: (isLoading: boolean) => void;
  
  // History Actions
  fetchNotesHistory: (dayId: string) => Promise<void>;
  setActiveVersion: (versionId: string) => void;
  
  // Socratic Actions
  incrementSocraticRetry: () => void;
  resetSocratic: () => void;
  setSocraticAnswered: (correct: boolean | null) => void;
  addSocraticAttempt: (msg: string) => void;
  
  // Simplifier Actions
  setSimplifierAnswer: (questionId: number, optionIndex: number) => void;
  checkSimplifierUnlock: (correctIndices: { [key: number]: number }) => void;
  resetSimplifier: () => void;
  
  // Audio Actions
  setPlaying: (playing: boolean) => void;
  setActiveSentenceIndex: (index: number) => void;
  setSpeechRate: (rate: number) => void;
  setSpeechPitch: (pitch: number) => void;
  toggleFocusMode: () => void;
}

const getInitialToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('edlearn_token') || null;
  }
  return null;
};

const getInitialUser = () => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('edlearn_user');
    return stored ? JSON.parse(stored) : null;
  }
  return null;
};

// Initialize default axios headers if token exists
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('edlearn_token');
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  token: getInitialToken(),
  user: getInitialUser(),
  userProfile: null,
  roadmap: null,
  currentDay: null,
  currentTopicTitle: '',
  currentTopicId: null,
  activeMode: 1,
  generatedContent: null,
  isLoadingContent: false,
  socraticRetryCount: 0,
  socraticAnsweredCorrectly: null,
  socraticAttempts: [],
  simplifierUnlocked: false,
  simplifierAnswers: {},
  isPlaying: false,
  activeSentenceIndex: -1,
  speechRate: 1.0,
  speechPitch: 1.0,
  focusMode: false,
  notesHistory: [],
  activeVersionId: null,
  restoringSession: getInitialToken() !== null,

  login: (token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('edlearn_token', token);
      localStorage.setItem('edlearn_user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    set({ token, user });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('edlearn_token');
      localStorage.removeItem('edlearn_user');
      delete axios.defaults.headers.common['Authorization'];
    }
    set({ 
      token: null, 
      user: null, 
      roadmap: null, 
      currentDay: null, 
      userProfile: null,
      generatedContent: null,
      isPlaying: false,
      activeSentenceIndex: -1,
      notesHistory: [],
      activeVersionId: null,
      restoringSession: false
    });
  },

  fetchCurrentUser: async () => {
    const { token } = get();
    if (!token) {
      set({ restoringSession: false });
      return;
    }
    set({ restoringSession: true });
    try {
      const res = await axios.get('/api/auth/me');
      if (res.data?.success) {
        const { user } = res.data;
        set({ 
          user: { id: user.id, email: user.email, fullName: user.fullName },
          userProfile: user.profile || null 
        });

        // Restore active cached roadmap if available
        if (user.activeRoadmap) {
          const r = user.activeRoadmap;
          set({
            roadmap: r,
            currentDay: r.days[0] || null,
            currentTopicTitle: r.days[0]?.title || ''
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch user context:', err);
      get().logout();
    } finally {
      set({ restoringSession: false });
    }
  },

  setUserProfile: (profile) => set({ userProfile: profile }),
  setRoadmap: (roadmap) => set({ roadmap, currentDay: roadmap.days[0] || null, currentTopicTitle: roadmap.days[0]?.title || '' }),
  selectDay: (day) => set({ 
    currentDay: day, 
    currentTopicTitle: day.title,
    generatedContent: null, 
    socraticRetryCount: 0,
    socraticAnsweredCorrectly: null,
    socraticAttempts: [],
    simplifierUnlocked: false,
    simplifierAnswers: {},
    activeSentenceIndex: -1,
    isPlaying: false,
    notesHistory: [],
    activeVersionId: null
  }),
  setTopicTitle: (title) => set({ currentTopicTitle: title }),
  setActiveMode: (mode) => set({ 
    activeMode: mode,
    socraticRetryCount: 0,
    socraticAnsweredCorrectly: null,
    socraticAttempts: [],
    simplifierUnlocked: false,
    simplifierAnswers: {},
    activeSentenceIndex: -1,
    isPlaying: false
  }),
  setGeneratedContent: (content) => set({ generatedContent: content }),

  fetchNotesHistory: async (dayId) => {
    try {
      const res = await axios.get(`/api/topic?dayId=${dayId}`);
      if (res.data?.success) {
        const topics = res.data.topics || [];
        set({ notesHistory: topics });
        
        if (topics.length > 0) {
          // Parse and load the most recent version
          const mostRecent = topics[0];
          try {
            const parsed = JSON.parse(mostRecent.notesHtml);
            set({ 
              generatedContent: parsed,
              activeVersionId: mostRecent.id 
            });
          } catch (err) {
            console.error('Failed to parse active version JSON:', err);
            set({ generatedContent: null, activeVersionId: null });
          }
        } else {
          set({ generatedContent: null, activeVersionId: null });
        }
      }
    } catch (err) {
      console.error('Failed to fetch topics history:', err);
      set({ notesHistory: [], activeVersionId: null, generatedContent: null });
    }
  },

  setActiveVersion: (versionId) => {
    const { notesHistory } = get();
    const target = notesHistory.find((t) => t.id === versionId);
    if (target) {
      try {
        const parsed = JSON.parse(target.notesHtml);
        set({ 
          generatedContent: parsed,
          activeVersionId: target.id 
        });
      } catch (err) {
        console.error('Failed to parse selected version JSON:', err);
      }
    }
  },
  setLoadingContent: (isLoading) => set({ isLoadingContent: isLoading }),
  
  incrementSocraticRetry: () => set((state) => ({ socraticRetryCount: state.socraticRetryCount + 1 })),
  resetSocratic: () => set({ socraticRetryCount: 0, socraticAnsweredCorrectly: null, socraticAttempts: [] }),
  setSocraticAnswered: (correct) => set({ socraticAnsweredCorrectly: correct }),
  addSocraticAttempt: (msg) => set((state) => ({ socraticAttempts: [...state.socraticAttempts, msg] })),
  
  setSimplifierAnswer: (qId, optionIdx) => set((state) => ({
    simplifierAnswers: { ...state.simplifierAnswers, [qId]: optionIdx }
  })),
  checkSimplifierUnlock: (correctIndices) => set((state) => {
    let unlocked = true;
    Object.keys(correctIndices).forEach((qIdStr) => {
      const qId = parseInt(qIdStr, 10);
      if (state.simplifierAnswers[qId] !== correctIndices[qId]) {
        unlocked = false;
      }
    });
    return { simplifierUnlocked: unlocked };
  }),
  resetSimplifier: () => set({ simplifierUnlocked: false, simplifierAnswers: {} }),
  
  setPlaying: (playing) => set({ isPlaying: playing }),
  setActiveSentenceIndex: (index) => set({ activeSentenceIndex: index }),
  setSpeechRate: (rate) => set({ speechRate: rate }),
  setSpeechPitch: (pitch) => set({ speechPitch: pitch }),
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
}));
