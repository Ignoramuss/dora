import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Annotation, ConversationMessage } from './api';
import type { BundledTheme } from 'shiki';

export type OpenTab = {
  path: string;
  language: string;
  content: string;
};

export type ExplanationView = {
  id: string; // local id
  title: string;
  filePath: string;
  startLine: number;
  endLine: number;
  selectedText: string;
  body: string;
  loading?: boolean;
  annotation?: Annotation;
  conversation?: ConversationMessage[];
  rating?: 'up' | 'down';
};

type State = {
  currentRepoId: number | null;
  setRepo: (id: number | null) => void;

  expandedDirs: Record<string, boolean>;
  toggleDir: (path: string) => void;

  openTabs: OpenTab[];
  activeTabPath: string | null;
  openTab: (tab: OpenTab) => void;
  closeTab: (path: string) => void;
  closeOthers: (path: string) => void;
  setActiveTab: (path: string) => void;
  updateTabContent: (path: string, content: string, language: string) => void;

  theme: BundledTheme;
  setTheme: (t: BundledTheme) => void;

  explanations: ExplanationView[];
  activeExplanationId: string | null;
  addExplanation: (view: ExplanationView) => void;
  updateExplanation: (id: string, partial: Partial<ExplanationView>) => void;
  removeExplanation: (id: string) => void;
  setActiveExplanation: (id: string | null) => void;

  pinned: ExplanationView[];
  pinExplanation: (id: string) => void;
  unpinExplanation: (id: string) => void;

  bottomPanel: 'none' | 'annotations' | 'journal' | 'architecture';
  setBottomPanel: (p: 'none' | 'annotations' | 'journal' | 'architecture') => void;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      currentRepoId: null,
      setRepo: (id) =>
        set({
          currentRepoId: id,
          openTabs: [],
          activeTabPath: null,
          explanations: [],
          activeExplanationId: null,
          pinned: [],
        }),

      expandedDirs: { '': true },
      toggleDir: (path) =>
        set((s) => ({ expandedDirs: { ...s.expandedDirs, [path]: !s.expandedDirs[path] } })),

      openTabs: [],
      activeTabPath: null,
      openTab: (tab) =>
        set((s) => {
          const exists = s.openTabs.find((t) => t.path === tab.path);
          if (exists) {
            return { activeTabPath: tab.path };
          }
          return { openTabs: [...s.openTabs, tab], activeTabPath: tab.path };
        }),
      closeTab: (path) =>
        set((s) => {
          const idx = s.openTabs.findIndex((t) => t.path === path);
          const newTabs = s.openTabs.filter((t) => t.path !== path);
          let active = s.activeTabPath;
          if (active === path) {
            active = newTabs[idx]?.path || newTabs[idx - 1]?.path || newTabs[0]?.path || null;
          }
          return { openTabs: newTabs, activeTabPath: active };
        }),
      closeOthers: (path) =>
        set((s) => {
          const keep = s.openTabs.find((t) => t.path === path);
          return { openTabs: keep ? [keep] : [], activeTabPath: keep ? keep.path : null };
        }),
      setActiveTab: (path) => set({ activeTabPath: path }),
      updateTabContent: (path, content, language) =>
        set((s) => ({
          openTabs: s.openTabs.map((t) =>
            t.path === path ? { ...t, content, language } : t
          ),
        })),

      theme: 'github-dark' as BundledTheme,
      setTheme: (t) => set({ theme: t }),

      explanations: [],
      activeExplanationId: null,
      addExplanation: (view) =>
        set((s) => ({
          explanations: [view, ...s.explanations].slice(0, 30),
          activeExplanationId: view.id,
        })),
      updateExplanation: (id, partial) =>
        set((s) => ({
          explanations: s.explanations.map((e) =>
            e.id === id ? { ...e, ...partial } : e
          ),
          pinned: s.pinned.map((e) => (e.id === id ? { ...e, ...partial } : e)),
        })),
      removeExplanation: (id) =>
        set((s) => ({
          explanations: s.explanations.filter((e) => e.id !== id),
          activeExplanationId: s.activeExplanationId === id ? null : s.activeExplanationId,
        })),
      setActiveExplanation: (id) => set({ activeExplanationId: id }),

      pinned: [],
      pinExplanation: (id) => {
        const exp = get().explanations.find((e) => e.id === id);
        if (!exp) return;
        set((s) => {
          if (s.pinned.find((p) => p.id === id)) return s;
          return { pinned: [exp, ...s.pinned] };
        });
      },
      unpinExplanation: (id) =>
        set((s) => ({ pinned: s.pinned.filter((p) => p.id !== id) })),

      bottomPanel: 'none',
      setBottomPanel: (p) => set({ bottomPanel: p }),
    }),
    {
      name: 'codelens-ui',
      partialize: (s) => ({
        expandedDirs: s.expandedDirs,
        theme: s.theme,
      }),
    }
  )
);
