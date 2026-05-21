import { useCallback, useEffect, useRef, useState } from 'react';
import { api, Annotation, Repo } from './lib/api';
import { useStore } from './lib/store';
import { RepoLanding } from './components/RepoLanding';
import { FileTree } from './components/FileTree';
import { TabBar } from './components/TabBar';
import { CodeViewer } from './components/CodeViewer';
import { ExplanationPanel } from './components/ExplanationPanel';
import { BottomPanel } from './components/BottomPanel';
import { AVAILABLE_THEMES } from './lib/shiki';
import type { BundledTheme } from 'shiki';
import { SelectionAction } from './components/SelectionToolbar';

export default function App() {
  const currentRepoId = useStore((s) => s.currentRepoId);
  const setRepo = useStore((s) => s.setRepo);
  const openTabs = useStore((s) => s.openTabs);
  const activeTabPath = useStore((s) => s.activeTabPath);
  const openTab = useStore((s) => s.openTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const updateTabContent = useStore((s) => s.updateTabContent);
  const addExplanation = useStore((s) => s.addExplanation);
  const updateExplanation = useStore((s) => s.updateExplanation);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  const [repo, setActiveRepo] = useState<Repo | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // Restore repo
  useEffect(() => {
    if (!currentRepoId) {
      setActiveRepo(null);
      return;
    }
    api.repos.list().then((all) => {
      const r = all.find((x) => x.id === currentRepoId);
      setActiveRepo(r || null);
      if (!r) setRepo(null);
    });
  }, [currentRepoId]);

  const reloadAnnotations = useCallback(async () => {
    if (!currentRepoId || !activeTabPath) {
      setAnnotations([]);
      return;
    }
    try {
      const list = await api.annotations.forFile(currentRepoId, activeTabPath);
      setAnnotations(list);
    } catch {
      setAnnotations([]);
    }
  }, [currentRepoId, activeTabPath]);

  useEffect(() => {
    reloadAnnotations();
  }, [reloadAnnotations]);

  const openFile = useCallback(
    async (path: string, line?: number) => {
      if (!currentRepoId) return;
      const existing = openTabs.find((t) => t.path === path);
      if (existing) {
        setActiveTab(path);
      } else {
        try {
          const f = await api.repos.file(currentRepoId, path);
          openTab({ path: f.path, language: f.language, content: f.content });
        } catch (e: any) {
          alert(`Failed to open ${path}: ${e.message}`);
          return;
        }
      }
      if (line) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = document.querySelector(`.code-line[data-line="${line}"]`) as HTMLElement;
            if (el) {
              el.scrollIntoView({ block: 'center', behavior: 'smooth' });
              el.style.transition = 'background 1.2s';
              const old = el.style.background;
              el.style.background = 'rgba(96, 165, 250, 0.25)';
              setTimeout(() => {
                el.style.background = old;
              }, 1200);
            }
          });
        });
      }
    },
    [currentRepoId, openTabs, openTab, setActiveTab]
  );

  const handleSelectionAction = useCallback(
    async (
      action: SelectionAction,
      payload: {
        startLine: number;
        startCol: number;
        endLine: number;
        endCol: number;
        selectedText: string;
      }
    ) => {
      if (!currentRepoId || !activeTabPath) return;
      const id = `exp-${Date.now()}`;
      const title =
        action.kind === 'explain'
          ? `Explain ${activeTabPath}:${payload.startLine}`
          : action.kind === 'syntax'
          ? `Syntax ${activeTabPath}:${payload.startLine}`
          : action.kind === 'trace'
          ? `Trace ${activeTabPath}:${payload.startLine}`
          : `Ask ${activeTabPath}:${payload.startLine}`;
      addExplanation({
        id,
        title,
        filePath: activeTabPath,
        startLine: payload.startLine,
        endLine: payload.endLine,
        selectedText: payload.selectedText,
        body: '',
        loading: true,
      });

      try {
        let body = '';
        if (action.kind === 'explain') {
          const r = await api.ai.explain({
            repoId: currentRepoId,
            filePath: activeTabPath,
            startLine: payload.startLine,
            endLine: payload.endLine,
            selectedText: payload.selectedText,
          });
          body = r.explanation;
        } else if (action.kind === 'syntax') {
          const r = await api.ai.syntax({
            filePath: activeTabPath,
            selectedText: payload.selectedText,
          });
          body = r.explanation;
        } else if (action.kind === 'trace') {
          const r = await api.ai.trace({
            repoId: currentRepoId,
            filePath: activeTabPath,
            startLine: payload.startLine,
            endLine: payload.endLine,
            selectedText: payload.selectedText,
          });
          const defs = r.definitions
            .filter((d) => d.kind === 'definition')
            .map((d) => `- \`${d.file}:${d.line}\``)
            .join('\n');
          body = `${r.explanation}\n\n${defs ? `**Static matches:**\n${defs}` : ''}`;
        } else if (action.kind === 'ask') {
          const r = await api.ai.explain({
            repoId: currentRepoId,
            filePath: activeTabPath,
            startLine: payload.startLine,
            endLine: payload.endLine,
            selectedText: `${payload.selectedText}\n\n[User's question about this selection: ${action.question}]`,
          });
          body = r.explanation;
        }

        // Persist as annotation so follow-ups work
        const ann = await api.annotations.create({
          repoId: currentRepoId,
          filePath: activeTabPath,
          startLine: payload.startLine,
          startCol: payload.startCol,
          endLine: payload.endLine,
          endCol: payload.endCol,
          selectedText: payload.selectedText,
          color: 'yellow',
          aiExplanation: body,
          kind: action.kind,
        });

        updateExplanation(id, {
          body,
          loading: false,
          annotation: ann,
          conversation: [],
        });
        reloadAnnotations();
      } catch (e: any) {
        updateExplanation(id, {
          body: `**Error:** ${e.message}`,
          loading: false,
        });
      }
    },
    [currentRepoId, activeTabPath, addExplanation, updateExplanation, reloadAnnotations]
  );

  if (!currentRepoId || !repo) {
    return (
      <RepoLanding
        onOpen={(r) => {
          setRepo(r.id);
          setActiveRepo(r);
        }}
      />
    );
  }

  const activeTab = openTabs.find((t) => t.path === activeTabPath);

  return (
    <div className="h-full flex flex-col bg-ink-950 text-ink-100">
      <TopBar
        repo={repo}
        theme={theme}
        onTheme={setTheme}
        onBack={() => setRepo(null)}
      />
      <div className="flex-1 flex min-h-0">
        <Resizable initialWidth={260} minWidth={180} maxWidth={520} side="left">
          <FileTree
            repoId={currentRepoId}
            onFileClick={(p) => openFile(p)}
            activePath={activeTabPath}
          />
        </Resizable>

        <div className="flex-1 flex flex-col min-w-0">
          <TabBar />
          <div className="flex-1 min-h-0 flex">
            <div className="flex-1 min-w-0 flex flex-col">
              {activeTab ? (
                <CodeViewer
                  repoId={currentRepoId}
                  filePath={activeTab.path}
                  content={activeTab.content}
                  language={activeTab.language}
                  onAction={handleSelectionAction}
                  annotations={annotations}
                  reloadAnnotations={reloadAnnotations}
                />
              ) : (
                <div className="flex-1 grid place-items-center text-ink-500 text-sm">
                  Open a file from the tree to start exploring.
                </div>
              )}
              <BottomPanel repoId={currentRepoId} onOpenFile={openFile} />
            </div>

            <Resizable initialWidth={420} minWidth={280} maxWidth={720} side="right">
              <ExplanationPanel onOpenFile={openFile} />
            </Resizable>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopBar({
  repo,
  theme,
  onTheme,
  onBack,
}: {
  repo: Repo;
  theme: BundledTheme;
  onTheme: (t: BundledTheme) => void;
  onBack: () => void;
}) {
  return (
    <div className="h-10 border-b border-ink-800 bg-ink-900 px-3 flex items-center gap-3 text-sm">
      <button
        onClick={onBack}
        className="text-ink-400 hover:text-ink-100 text-xs"
        title="Back to repo list"
      >
        ← Repos
      </button>
      <span className="text-ink-100 font-medium">{repo.name}</span>
      {repo.branch && (
        <span className="text-[10px] uppercase tracking-wider text-ink-400 px-1.5 py-0.5 border border-ink-700 rounded">
          {repo.branch}
        </span>
      )}
      <span className="text-xs text-ink-500 font-mono truncate flex-1">{repo.cloned_path}</span>
      <select
        value={theme}
        onChange={(e) => onTheme(e.target.value as BundledTheme)}
        className="bg-ink-800 border border-ink-700 rounded px-2 py-1 text-xs"
      >
        {AVAILABLE_THEMES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}

function Resizable({
  children,
  initialWidth,
  minWidth,
  maxWidth,
  side,
}: {
  children: React.ReactNode;
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  side: 'left' | 'right';
}) {
  const [width, setWidth] = useState(initialWidth);
  const draggingRef = useRef(false);

  const onMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true;
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = side === 'left' ? ev.clientX - startX : startX - ev.clientX;
      setWidth(Math.min(maxWidth, Math.max(minWidth, startW + delta)));
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="flex h-full" style={{ width }}>
      {side === 'right' && <div className="resizer-vertical" onMouseDown={onMouseDown} />}
      <div className="flex-1 min-w-0">{children}</div>
      {side === 'left' && <div className="resizer-vertical" onMouseDown={onMouseDown} />}
    </div>
  );
}
