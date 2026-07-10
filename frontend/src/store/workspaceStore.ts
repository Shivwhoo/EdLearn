import { create } from 'zustand';

export interface UserProfile {
  fullName: string;
  careerGoal: string;
  currentSkills: string[];
  availableTime: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface Day {
  id: string;
  dayNumber: number;
  title: string;
  duration: number;
}

export interface Roadmap {
  id: string;
  title: string;
  isAchievable: boolean;
  days: Day[];
}

export interface WorkspaceState {
  // User Onboarding and Roadmap Data
  userProfile: UserProfile | null;
  roadmap: Roadmap | null;
  currentDay: Day | null;
  currentTopicTitle: string;
  currentTopicId: string | null;
  
  // Pedagogical Model generation state
  activeMode: number; // 1 to 6
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

  // Actions
  setUserProfile: (profile: UserProfile) => void;
  setRoadmap: (roadmap: Roadmap) => void;
  selectDay: (day: Day) => void;
  setTopicTitle: (title: string) => void;
  setActiveMode: (mode: number) => void;
  setGeneratedContent: (content: any) => void;
  setLoadingContent: (isLoading: boolean) => void;
  
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

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
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
    isPlaying: false
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
