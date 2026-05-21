import { useEffect, useState } from 'react';
import { api, Repo } from '../lib/api';
import { useStore } from '../lib/store';

export function RepoLanding({ onOpen }: { onOpen: (repo: Repo) => void }) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [model, setModel] = useState('');

  const refresh = async () => {
    try {
      const r = await api.repos.list();
      setRepos(r);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    refresh();
    api.health().then((h) => {
      setAiConfigured(h.aiConfigured);
      setModel(h.model);
    }).catch(() => {});
  }, []);

  const handleClone = async () => {
    if (!url.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const repo = await api.repos.clone(url.trim(), branch.trim() || undefined);
      onOpen(repo);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLocal = async () => {
    if (!localPath.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const repo = await api.repos.addLocal(localPath.trim());
      onOpen(repo);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: number) => {
    if (!confirm('Remove this repo from CodeLens? (Files on disk are not deleted.)')) return;
    await api.repos.remove(id);
    refresh();
  };

  return (
    <div className="h-full overflow-auto bg-ink-950">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-baseline justify-between mb-2">
          <h1 className="text-3xl font-semibold text-ink-50">CodeLens</h1>
          <span className="text-xs text-ink-400 font-mono">{model || 'AI not configured'}</span>
        </div>
        <p className="text-ink-400 mb-8">
          Explore an unfamiliar codebase. Highlight any code, get explanations, build a mental
          model — everything persisted locally.
        </p>

        {!aiConfigured && (
          <div className="mb-6 px-4 py-3 rounded border border-amber-700/50 bg-amber-900/20 text-amber-200 text-sm">
            <strong>Heads up:</strong> No <code className="font-mono">ANTHROPIC_API_KEY</code>{' '}
            in <code className="font-mono">.env</code>. AI features will fail until you add one
            and restart the backend.
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 mb-10">
          <div className="border border-ink-700 rounded-lg p-5 bg-ink-900">
            <h2 className="font-medium mb-3 text-ink-100">Open a GitHub repo</h2>
            <input
              className="w-full px-3 py-2 rounded bg-ink-800 border border-ink-700 mb-2 text-sm font-mono"
              placeholder="https://github.com/user/repo"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleClone()}
            />
            <input
              className="w-full px-3 py-2 rounded bg-ink-800 border border-ink-700 mb-2 text-sm font-mono"
              placeholder="branch (optional)"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
            <button
              onClick={handleClone}
              disabled={loading || !url.trim()}
              className="w-full px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-ink-700 disabled:text-ink-400 text-white text-sm font-medium"
            >
              {loading ? 'Cloning…' : 'Clone & open'}
            </button>
          </div>

          <div className="border border-ink-700 rounded-lg p-5 bg-ink-900">
            <h2 className="font-medium mb-3 text-ink-100">Open a local folder</h2>
            <input
              className="w-full px-3 py-2 rounded bg-ink-800 border border-ink-700 mb-2 text-sm font-mono"
              placeholder="/absolute/path/to/repo"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLocal()}
            />
            <button
              onClick={handleLocal}
              disabled={loading || !localPath.trim()}
              className="w-full px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-ink-700 disabled:text-ink-400 text-white text-sm font-medium"
            >
              Open folder
            </button>
            <p className="text-xs text-ink-400 mt-2">
              Files stay where they are — CodeLens reads them in place.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded border border-red-700/50 bg-red-900/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        <h2 className="text-sm uppercase tracking-wide text-ink-400 mb-3">Recent repos</h2>
        {repos.length === 0 ? (
          <p className="text-ink-500 text-sm italic">No repos yet — clone or open one above.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {repos.map((r) => (
              <button
                key={r.id}
                onClick={() => onOpen(r)}
                className="text-left border border-ink-700 hover:border-blue-500 rounded-lg p-4 bg-ink-900 hover:bg-ink-800/60 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="font-medium text-ink-100">{r.name}</div>
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-ink-800 text-ink-400">
                    {r.source_type}
                  </span>
                </div>
                <div className="text-xs text-ink-400 font-mono mt-1 truncate">
                  {r.branch ? `${r.branch} · ` : ''}{r.source_url_or_path}
                </div>
                <div className="flex items-center justify-between mt-3 text-xs text-ink-500">
                  <span>{r.annotation_count ?? 0} annotation{(r.annotation_count ?? 0) === 1 ? '' : 's'}</span>
                  <span>{new Date(r.last_opened_at + 'Z').toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <span
                    className="text-[10px] text-ink-500 hover:text-red-400 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(r.id);
                    }}
                  >
                    Remove
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
