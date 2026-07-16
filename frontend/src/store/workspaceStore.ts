import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

export interface UserProfile {
  id?: string;
  fullName?: string;
  email?: string;
  careerGoal?: string;
  difficulty?: string;
  currentSkills?: string[];
  availableTime?: number;
}

export interface Roadmap {
  id: string;
  title: string;
  deadline: string;
  days: any[];
}

export interface Day {
  id: string;
  dayNumber: number;
  title: string;
  topics: any[];
}

interface WorkspaceState {
  // Auth state
  token: string | null;
  user: any | null;

  // Workspace state
  roadmap: Roadmap | null;
  currentDay: Day | null;
  activeMode: number;
  userProfile: UserProfile | null;
  generatedContent: any | null;
  isLoadingContent: boolean;
  restoringSession: boolean;

  // Audio / TTS state
  isPlaying: boolean;
  activeSentenceIndex: number;
  speechRate: number;
  focusMode: boolean;

  // Notes version history
  notesHistory: any[];
  activeVersionId: string | null;

  // Setters
  setToken: (token: string | null) => void;
  setUser: (user: any | null) => void;
  setRoadmap: (roadmap: Roadmap | null) => void;
  setCurrentDay: (day: Day | null) => void;
  setActiveMode: (mode: number) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setGeneratedContent: (content: any | null) => void;
  setLoadingContent: (loading: boolean) => void;
  setRestoringSession: (restoring: boolean) => void;

  // Audio setters
  setPlaying: (playing: boolean) => void;
  setActiveSentenceIndex: (index: number) => void;
  setSpeechRate: (rate: number) => void;
  toggleFocusMode: () => void;

  // Version history
  setActiveVersion: (id: string) => void;

  // Actions
  fetchCurrentUser: () => Promise<void>;
  fetchNotesHistory: (dayId: string) => Promise<void>;
  logout: () => void;
  selectDay: (day: Day) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      roadmap: null,
      currentDay: null,
      activeMode: 1,
      userProfile: null,

      generatedContent: null,
      isLoadingContent: false,
      restoringSession: true,

      // Audio / TTS defaults
      isPlaying: false,
      activeSentenceIndex: -1,
      speechRate: 1.0,
      focusMode: false,

      // Notes version history defaults
      notesHistory: [],
      activeVersionId: null,

      setToken: (token: string | null) => {
        set({ token });

        if (typeof window !== 'undefined') {
          if (token) {
            localStorage.setItem('token', token);
          } else {
            localStorage.removeItem('token');
          }
        }
      },

      setUser: (user) => set({ user }),

      setRoadmap: (roadmap) => set({ roadmap }),

      setCurrentDay: (currentDay) => set({ currentDay }),

      setActiveMode: (activeMode) => set({ activeMode }),

      setUserProfile: (userProfile) => set({ userProfile }),

      setGeneratedContent: (generatedContent) =>
        set({ generatedContent }),

      setLoadingContent: (isLoadingContent) =>
        set({ isLoadingContent }),

      setRestoringSession: (restoringSession) =>
        set({ restoringSession }),

      // Audio setters
      setPlaying: (isPlaying) => set({ isPlaying }),

      setActiveSentenceIndex: (activeSentenceIndex) =>
        set({ activeSentenceIndex }),

      setSpeechRate: (speechRate) => set({ speechRate }),

      toggleFocusMode: () =>
        set((state) => ({ focusMode: !state.focusMode })),

      // Version history: switch to a specific version from notesHistory
      setActiveVersion: (id: string) => {
        const { notesHistory } = get();
        const target = notesHistory.find((t: any) => t.id === id);
        if (target) {
          try {
            const parsed = typeof target.notesHtml === 'string'
              ? JSON.parse(target.notesHtml)
              : target.notesHtml;
            set({ activeVersionId: id, generatedContent: parsed });
          } catch (err) {
            console.error('Failed to parse version notes:', err);
          }
        }
      },

      selectDay: (day: Day) => {
        // Reset content state when switching days
        set({
          currentDay: day,
          generatedContent: null,
          notesHistory: [],
          activeVersionId: null,
          isPlaying: false,
          activeSentenceIndex: -1,
        });
      },

      fetchCurrentUser: async () => {
        const {
          token,
          setUser,
          setUserProfile,
          setRoadmap,
          selectDay,
        } = get();

        if (!token) {
          set({ restoringSession: false });
          return;
        }

        try {
          const response = await axios.get('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.data?.success) {
            const userData = response.data.user;

            setUser(userData);

            // Restore profile from the backend response
            if (userData.profile) {
              setUserProfile(userData.profile);
            }

            // Restore active roadmap if the backend returned one
            if (userData.activeRoadmap) {
              setRoadmap(userData.activeRoadmap);

              // Auto-select first day if none is selected
              const { currentDay } = get();
              if (!currentDay && userData.activeRoadmap.days?.length > 0) {
                // Use set directly instead of selectDay to avoid clearing content
                set({ currentDay: userData.activeRoadmap.days[0] });
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch user:', error);
        } finally {
          set({ restoringSession: false });
        }
      },

      fetchNotesHistory: async (dayId: string) => {
        const { token } = get();

        if (!token || !dayId) return;

        try {
          set({ isLoadingContent: true });

          const response = await axios.get("/api/topic", {
            params: {
              dayId,
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.data?.success) {
            const topics = response.data.topics || [];

            // Store full history for version switching
            set({ notesHistory: topics });

            if (topics.length > 0) {
              const latestTopic = topics[0]; // Already sorted desc by createdAt
              set({ activeVersionId: latestTopic.id });

              try {
                const parsed = typeof latestTopic.notesHtml === 'string'
                  ? JSON.parse(latestTopic.notesHtml)
                  : latestTopic.notesHtml;
                set({ generatedContent: parsed });
              } catch (parseErr) {
                console.error('Failed to parse topic notesHtml:', parseErr);
                set({ generatedContent: null });
              }
            } else {
              set({
                generatedContent: null,
                activeVersionId: null,
              });
            }
          }
        } catch (error) {
          console.error('fetchNotesHistory error:', error);
          set({ generatedContent: null, notesHistory: [], activeVersionId: null });
        } finally {
          set({ isLoadingContent: false });
        }
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
        }

        set({
          token: null,
          user: null,
          roadmap: null,
          currentDay: null,
          userProfile: null,
          generatedContent: null,
          notesHistory: [],
          activeVersionId: null,
          isPlaying: false,
          activeSentenceIndex: -1,
          focusMode: false,
        });
      },
    }),
    {
      name: 'workspace-storage',

      partialize: (state) => ({
        token: state.token,
        user: state.user,
        roadmap: state.roadmap,
        currentDay: state.currentDay,
        activeMode: state.activeMode,
        userProfile: state.userProfile,
      }),
    }
  )
);