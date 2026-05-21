import { useEffect, useMemo, useState } from 'react';
import { api, TreeNode } from '../lib/api';
import { useStore } from '../lib/store';

type Props = {
  repoId: number;
  onFileClick: (path: string) => void;
  activePath: string | null;
};

export function FileTree({ repoId, onFileClick, activePath }: Props) {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [filter, setFilter] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [annotated, setAnnotated] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.repos.tree(repoId, showHidden).then(setTree).catch(() => setTree(null));
  }, [repoId, showHidden]);

  const refreshProgress = async () => {
    try {
      const p = await api.progress(repoId);
      setVisited(new Set(p.visits.map((v) => v.file_path)));
      setAnnotated(new Set(p.annotated.map((a) => a.file_path)));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshProgress();
    const i = setInterval(refreshProgress, 5000);
    return () => clearInterval(i);
  }, [repoId, activePath]);

  const filtered = useMemo(() => {
    if (!tree) return null;
    if (!filter.trim()) return tree;
    const q = filter.toLowerCase();
    const filterNode = (n: TreeNode): TreeNode | null => {
      if (n.type === 'file') {
        return n.path.toLowerCase().includes(q) ? n : null;
      }
      const kids = (n.children || []).map(filterNode).filter((x): x is TreeNode => !!x);
      if (kids.length === 0 && !n.name.toLowerCase().includes(q)) return null;
      return { ...n, children: kids };
    };
    return filterNode(tree);
  }, [tree, filter]);

  return (
    <div className="h-full flex flex-col bg-ink-900 border-r border-ink-800">
      <div className="px-3 py-2 border-b border-ink-800 flex items-center gap-2">
        <input
          className="flex-1 px-2 py-1 rounded bg-ink-800 border border-ink-700 text-xs font-mono focus:outline-none focus:border-blue-500"
          placeholder="Filter files…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          title={showHidden ? 'Hide ignored files' : 'Show ignored files'}
          onClick={() => setShowHidden((s) => !s)}
          className={`text-[10px] uppercase tracking-wide px-1.5 py-1 rounded border ${
            showHidden
              ? 'border-blue-600 text-blue-300'
              : 'border-ink-700 text-ink-400 hover:text-ink-200'
          }`}
        >
          .
        </button>
      </div>
      <div className="flex-1 overflow-auto py-1">
        {filtered ? (
          <Node
            node={filtered}
            depth={0}
            onFileClick={onFileClick}
            activePath={activePath}
            visited={visited}
            annotated={annotated}
            forceExpand={!!filter.trim()}
          />
        ) : (
          <div className="text-xs text-ink-500 px-3 py-2">Loading tree…</div>
        )}
      </div>
    </div>
  );
}

function Node({
  node,
  depth,
  onFileClick,
  activePath,
  visited,
  annotated,
  forceExpand,
}: {
  node: TreeNode;
  depth: number;
  onFileClick: (path: string) => void;
  activePath: string | null;
  visited: Set<string>;
  annotated: Set<string>;
  forceExpand: boolean;
}) {
  const expandedDirs = useStore((s) => s.expandedDirs);
  const toggleDir = useStore((s) => s.toggleDir);

  if (node.type === 'file') {
    const isActive = activePath === node.path;
    const isAnnotated = annotated.has(node.path);
    const isVisited = visited.has(node.path);
    const dotColor = isAnnotated ? 'bg-emerald-400' : isVisited ? 'bg-blue-400' : 'bg-transparent';
    return (
      <button
        onClick={() => onFileClick(node.path)}
        className={`w-full text-left px-2 py-0.5 text-xs font-mono flex items-center gap-1.5 truncate ${
          isActive ? 'bg-blue-900/40 text-blue-200' : 'text-ink-200 hover:bg-ink-800'
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <FileIcon name={node.name} />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  const isOpen = forceExpand || (expandedDirs[node.path] ?? depth === 0);
  return (
    <div>
      <button
        onClick={() => toggleDir(node.path)}
        className="w-full text-left px-2 py-0.5 text-xs font-mono flex items-center gap-1 text-ink-300 hover:bg-ink-800"
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <span className="w-3 text-ink-500">{isOpen ? '▾' : '▸'}</span>
        <span className="text-ink-400">📁</span>
        <span className="truncate">{node.name || '/'}</span>
      </button>
      {isOpen && (
        <div>
          {(node.children || []).map((c) => (
            <Node
              key={c.path || c.name}
              node={c}
              depth={depth + 1}
              onFileClick={onFileClick}
              activePath={activePath}
              visited={visited}
              annotated={annotated}
              forceExpand={forceExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const icon = ICONS[ext] || '📄';
  return <span className="opacity-80">{icon}</span>;
}

const ICONS: Record<string, string> = {
  ts: '🟦',
  tsx: '🟦',
  js: '🟨',
  jsx: '🟨',
  py: '🐍',
  go: '🐹',
  rs: '🦀',
  java: '☕',
  cpp: '⚙️',
  c: '⚙️',
  h: '⚙️',
  rb: '💎',
  json: '📦',
  md: '📝',
  yml: '⚙️',
  yaml: '⚙️',
  toml: '⚙️',
  html: '🌐',
  css: '🎨',
  sql: '🗄️',
  sh: '💻',
  zig: '⚡',
  hs: '🅷',
};
