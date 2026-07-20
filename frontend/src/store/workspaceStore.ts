import { create } from 'zustand';
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

export interface Day {
  id: string;
  dayNumber: number;
  title: string;
  topics: any[];
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

export interface Badge {
  id: string;
  title: string;
  description?: string | null;
  badgeType: string;
  imageUrl?: string | null;
  earnedAt: string;
}

function getInitialToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('edlearn_token');
}

function getInitialUser(): any | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('edlearn_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getInitialCompletedDays(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  const raw = localStorage.getItem('edlearn_completed_days');
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

export interface WorkspaceState {
  // Auth State

  token: string | null;
  user: any | null;

  // Workspace state
  roadmap: Roadmap | null;
  currentDay: Day | null;
  currentTopicTitle: string;
  currentTopicId: string | null;
  activeMode: number;
  userProfile: UserProfile | null;
  generatedContent: any | null;
  isLoadingContent: boolean;
  restoringSession: boolean;

  // Audio / TTS state
  isPlaying: boolean;
  activeSentenceIndex: number;
  speechRate: number;
  speechPitch: number;
  focusMode: boolean;

  // Notes version history
  notesHistory: any[];
  activeVersionId: string | null;


  // Scroll-based completion tracking
  completedDays: Set<string>;

  // Badges (course-completion rewards, persisted in the backend)
  badges: Badge[];
  newBadge: Badge | null; // set when a badge is freshly earned, drives the celebration modal

  // Socratic state
  socraticRetryCount: number;
  socraticAnsweredCorrectly: boolean | null;
  socraticAttempts: string[];

  // Simplifier state
  simplifierUnlocked: boolean;
  simplifierAnswers: { [key: number]: number };

  // Actions
  login: (token: string, user: UserSession) => void;
  logout: () => void;
  setToken: (token: string) => void;
  setUser: (user: any) => void;
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

  // Completion Actions
  markDayCompleted: (dayId: string) => Promise<void>;
  dismissNewBadge: () => void;

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
  completedDays: getInitialCompletedDays(),
  badges: [],
  newBadge: null,

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
      localStorage.removeItem('edlearn_completed_days');
      delete axios.defaults.headers.common['Authorization'];
    }
    set({
      token: null,
      user: null,
      roadmap: null,
      currentDay: null,

      userProfile: null,

      generatedContent: null,
      isLoadingContent: false,

      // Audio / TTS defaults
      isPlaying: false,
      activeSentenceIndex: -1,
      speechRate: 1.0,
      focusMode: false,

      // Notes version history defaults
      notesHistory: [],
      activeVersionId: null,

      restoringSession: false,
      completedDays: new Set(),
      badges: [],
      newBadge: null,
    });
  },

  setToken: (token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('edlearn_token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    set({ token });
  },

  setUser: (user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('edlearn_user', JSON.stringify(user));
    }
    set({ user });
  },

  fetchCurrentUser: async () => {
    const {
      token,
      setUser,
      setUserProfile,
      setRoadmap,
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
      // A 401 here means the stored token is stale/expired or its user no
      // longer exists (e.g. after a DB reset). Clear the dead session so the
      // app cleanly shows logged-out instead of re-sending the same bad token
      // — and spamming this AxiosError — on every page load. Any other error
      // (network blip, backend down) keeps the token so a transient failure
      // doesn't log the user out.
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('edlearn_token');
          localStorage.removeItem('edlearn_user');
          delete axios.defaults.headers.common['Authorization'];
        }
        set({ token: null, user: null });
      } else {
        console.error('Failed to fetch user:', error);
      }
    } finally {
      set({ restoringSession: false });
    }
  },

  setUserProfile: (profile) =>
    set({ userProfile: profile }),

  setRoadmap: (roadmap) =>
    set({ roadmap }),

  selectDay: (day) =>
    set({
      currentDay: day,
      generatedContent: null,
      notesHistory: [],
      activeVersionId: null,
      activeMode: 1,
    }),

  setTopicTitle: (title) =>
    set({ currentTopicTitle: title }),

  setActiveMode: (mode) =>
    set({ activeMode: mode }),

  setGeneratedContent: (content) =>
    set({ generatedContent: content }),

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

  setActiveVersion: (versionId) => {
    const { notesHistory } = get();
    const version = notesHistory.find((item: any) => item.id === versionId);

    if (!version) {
      set({ activeVersionId: versionId });
      return;
    }

    try {
      const parsed = typeof version.notesHtml === 'string'
        ? JSON.parse(version.notesHtml)
        : version.notesHtml;
      set({ activeVersionId: versionId, generatedContent: parsed });
    } catch (parseErr) {
      console.error('Failed to parse version notesHtml:', parseErr);
      set({ activeVersionId: versionId });
    }
  },

  setLoadingContent: (isLoading) =>
    set({ isLoadingContent: isLoading }),

  markDayCompleted: async (dayId) => {
    const alreadyLocal = get().completedDays.has(dayId);

    set((state) => {
      const next = new Set(state.completedDays);
      next.add(dayId);

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'edlearn_completed_days',
          JSON.stringify([...next])
        );
      }

      return { completedDays: next };
    });

    try {
      const res = await axios.post('/api/progress/complete', { dayId });

      if (res.data?.success) {
        const serverCompleted: string[] =
          res.data.completedDayIds || [];

        set((state) => {
          const reconciled = new Set(state.completedDays);

          serverCompleted.forEach((id) =>
            reconciled.add(id)
          );

          if (typeof window !== 'undefined') {
            localStorage.setItem(
              'edlearn_completed_days',
              JSON.stringify([...reconciled])
            );
          }

          const earned = res.data.newlyEarnedBadge;

          return {
            completedDays: reconciled,
            ...(earned
              ? {
                badges: [
                  earned,
                  ...state.badges,
                ],
                newBadge: earned,
              }
              : {}),
          };
        });
      }
    } catch (err) {
      if (!alreadyLocal) {
        console.warn(
          'Failed to persist day completion:',
          err
        );
      }
    }
  },

  dismissNewBadge: () =>
    set({ newBadge: null }),

  incrementSocraticRetry: () =>
    set((state) => ({
      socraticRetryCount:
        state.socraticRetryCount + 1,
    })),

  resetSocratic: () =>
    set({
      socraticRetryCount: 0,
      socraticAnsweredCorrectly: null,
      socraticAttempts: [],
    }),

  setSocraticAnswered: (correct) =>
    set({
      socraticAnsweredCorrectly: correct,
    }),

  addSocraticAttempt: (msg) =>
    set((state) => ({
      socraticAttempts: [
        ...state.socraticAttempts,
        msg,
      ],
    })),

  setSimplifierAnswer: (qId, optionIdx) =>
    set((state) => ({
      simplifierAnswers: {
        ...state.simplifierAnswers,
        [qId]: optionIdx,
      },
    })),

  checkSimplifierUnlock: (correctIndices) =>
    set((state) => {
      let unlocked = true;

      Object.keys(correctIndices).forEach((qIdStr) => {
        const qId = Number(qIdStr);

        if (
          state.simplifierAnswers[qId] !==
          correctIndices[qId]
        ) {
          unlocked = false;
        }
      });

      return {
        simplifierUnlocked: unlocked,
      };
    }),

  resetSimplifier: () =>
    set({
      simplifierUnlocked: false,
      simplifierAnswers: {},
    }),

  setPlaying: (playing) =>
    set({
      isPlaying: playing,
    }),

  setActiveSentenceIndex: (index) =>
    set({
      activeSentenceIndex: index,
    }),

  setSpeechRate: (rate) =>
    set({
      speechRate: rate,
    }),

  setSpeechPitch: (pitch) =>
    set({
      speechPitch: pitch,
    }),

  toggleFocusMode: () =>
    set((state) => ({
      focusMode: !state.focusMode,
    })),
}));
