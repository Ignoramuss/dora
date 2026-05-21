import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, Annotation } from '../lib/api';
import { useStore } from '../lib/store';

type Props = {
  repoId: number;
  onOpenFile: (path: string, line?: number) => void;
};

export function BottomPanel({ repoId, onOpenFile }: Props) {
  const panel = useStore((s) => s.bottomPanel);
  const setPanel = useStore((s) => s.setBottomPanel);

  return (
    <div className="border-t border-ink-800 bg-ink-900">
      <div className="flex items-center gap-1 px-2 pt-1.5">
        <TabBtn active={panel === 'annotations'} onClick={() => setPanel(panel === 'annotations' ? 'none' : 'annotations')}>
          Annotations
        </TabBtn>
        <TabBtn active={panel === 'journal'} onClick={() => setPanel(panel === 'journal' ? 'none' : 'journal')}>
          Journal
        </TabBtn>
        <TabBtn active={panel === 'architecture'} onClick={() => setPanel(panel === 'architecture' ? 'none' : 'architecture')}>
          Architecture
        </TabBtn>
        {panel !== 'none' && (
          <button
            onClick={() => setPanel('none')}
            className="ml-auto text-ink-500 hover:text-ink-200 text-xs px-2"
          >
            collapse
          </button>
        )}
      </div>
      {panel !== 'none' && (
        <div className="h-64 overflow-auto border-t border-ink-800">
          {panel === 'annotations' && <AnnotationsPane repoId={repoId} onOpenFile={onOpenFile} />}
          {panel === 'journal' && <JournalPane repoId={repoId} />}
          {panel === 'architecture' && <ArchitecturePane repoId={repoId} onOpenFile={onOpenFile} />}
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs rounded-t border ${
        active
          ? 'bg-ink-950 border-ink-800 border-b-ink-950 text-ink-100'
          : 'border-transparent text-ink-400 hover:text-ink-200'
      }`}
    >
      {children}
    </button>
  );
}

function AnnotationsPane({ repoId, onOpenFile }: { repoId: number; onOpenFile: (p: string, l?: number) => void }) {
  const [items, setItems] = useState<Annotation[]>([]);

  const load = () => api.annotations.forRepo(repoId).then(setItems).catch(() => setItems([]));
  useEffect(() => {
    load();
  }, [repoId]);

  if (items.length === 0) {
    return <div className="p-4 text-xs text-ink-500">No annotations yet.</div>;
  }
  return (
    <div className="divide-y divide-ink-800">
      {items.map((a) => (
        <div key={a.id} className="px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <button
              className="text-xs font-mono text-blue-400 hover:underline"
              onClick={() => onOpenFile(a.file_path, a.start_line)}
            >
              {a.file_path}:{a.start_line}-{a.end_line}
            </button>
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: dotColor(a.color) }}
              />
              <button
                onClick={async () => {
                  await api.annotations.remove(a.id);
                  load();
                }}
                className="text-[10px] text-ink-500 hover:text-red-400"
              >
                delete
              </button>
            </div>
          </div>
          {a.user_note && <div className="text-xs text-ink-300 italic">{a.user_note}</div>}
          {a.selected_text && (
            <pre className="text-[10px] text-ink-500 font-mono whitespace-pre-wrap mt-1 max-h-12 overflow-hidden">
              {a.selected_text.slice(0, 240)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

function JournalPane({ repoId }: { repoId: number }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [draft, setDraft] = useState('');

  const load = () => api.journal.list(repoId).then(setEntries).catch(() => setEntries([]));
  useEffect(() => {
    load();
  }, [repoId]);

  const save = async () => {
    if (!draft.trim()) return;
    await api.journal.create(repoId, draft.trim());
    setDraft('');
    load();
  };

  return (
    <div className="p-3">
      <div className="flex gap-2 mb-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Note your understanding so far… (markdown supported)"
          className="flex-1 px-2 py-1.5 rounded bg-ink-800 border border-ink-700 text-xs"
          rows={2}
        />
        <button
          onClick={save}
          disabled={!draft.trim()}
          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-ink-700 text-white text-xs self-start"
        >
          Save
        </button>
      </div>
      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.id} className="border border-ink-800 rounded p-2 bg-ink-950">
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-ink-500">
                {new Date(e.created_at + 'Z').toLocaleString()}
              </span>
              <button
                onClick={async () => {
                  await api.journal.remove(e.id);
                  load();
                }}
                className="text-[10px] text-ink-500 hover:text-red-400"
              >
                delete
              </button>
            </div>
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{e.content_markdown}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchitecturePane({
  repoId,
  onOpenFile,
}: {
  repoId: number;
  onOpenFile: (p: string, l?: number) => void;
}) {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.ai.architecture(repoId);
      setSummary(r.summary);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-ink-400">
          Have Claude write an architecture overview from the file tree + key files.
        </span>
        <button
          onClick={generate}
          disabled={loading}
          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-ink-700 text-white text-xs"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>
      {error && <div className="text-xs text-red-300 mb-2">{error}</div>}
      {summary && (
        <div className="markdown">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: (props: any) => {
                const txt = String(props.children || '');
                const m = txt.match(/^([\w./_-]+)(?::(\d+))?$/);
                if (m) {
                  return (
                    <a
                      className="text-blue-400 hover:underline cursor-pointer"
                      onClick={() => onOpenFile(m[1], m[2] ? Number(m[2]) : undefined)}
                    >
                      <code>{txt}</code>
                    </a>
                  );
                }
                return <code {...props} />;
              },
            }}
          >
            {summary}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function dotColor(name: string): string {
  switch (name) {
    case 'green':
      return 'rgb(74, 222, 128)';
    case 'blue':
      return 'rgb(96, 165, 250)';
    case 'pink':
      return 'rgb(244, 114, 182)';
    default:
      return 'rgb(252, 211, 77)';
  }
}
