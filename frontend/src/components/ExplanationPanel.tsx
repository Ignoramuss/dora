import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore, ExplanationView } from '../lib/store';
import { api } from '../lib/api';

type Props = {
  onOpenFile: (path: string, line?: number) => void;
};

export function ExplanationPanel({ onOpenFile }: Props) {
  const explanations = useStore((s) => s.explanations);
  const activeId = useStore((s) => s.activeExplanationId);
  const setActive = useStore((s) => s.setActiveExplanation);
  const removeExplanation = useStore((s) => s.removeExplanation);
  const updateExplanation = useStore((s) => s.updateExplanation);
  const pinned = useStore((s) => s.pinned);
  const pin = useStore((s) => s.pinExplanation);
  const unpin = useStore((s) => s.unpinExplanation);

  const active = explanations.find((e) => e.id === activeId) || explanations[0];

  return (
    <div className="h-full flex flex-col bg-ink-900 border-l border-ink-800">
      <div className="border-b border-ink-800 px-3 py-2 flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-ink-400 font-medium">
          AI panel
        </span>
        <span className="ml-auto text-xs text-ink-500">
          {explanations.length} explanation{explanations.length === 1 ? '' : 's'}
        </span>
      </div>

      {pinned.length > 0 && (
        <div className="border-b border-ink-800 max-h-48 overflow-auto">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink-400">
            Pinned
          </div>
          {pinned.map((p) => (
            <div
              key={'pin-' + p.id}
              className="px-3 py-1.5 border-t border-ink-800 text-xs hover:bg-ink-800/50 cursor-pointer"
              onClick={() => setActive(p.id)}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono truncate text-ink-300">{p.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    unpin(p.id);
                  }}
                  className="text-ink-500 hover:text-amber-400 text-[10px]"
                >
                  unpin
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {explanations.length > 1 && (
        <div className="border-b border-ink-800 max-h-32 overflow-auto">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink-400">
            Recent
          </div>
          {explanations.map((e) => (
            <div
              key={e.id}
              className={`px-3 py-1.5 border-t border-ink-800 text-xs cursor-pointer ${
                active?.id === e.id ? 'bg-blue-900/30' : 'hover:bg-ink-800/50'
              }`}
              onClick={() => setActive(e.id)}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono truncate text-ink-300">{e.title}</span>
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    removeExplanation(e.id);
                  }}
                  className="text-ink-500 hover:text-red-400 text-[10px]"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {!active && (
          <div className="p-6 text-sm text-ink-500">
            Select code and click <em>Explain</em>, <em>Syntax</em>, <em>Trace</em>, or <em>Ask…</em>{' '}
            from the floating toolbar.
          </div>
        )}
        {active && (
          <ExplanationCard
            view={active}
            onOpenFile={onOpenFile}
            onPin={() => pin(active.id)}
            isPinned={!!pinned.find((p) => p.id === active.id)}
            onUpdate={(p) => updateExplanation(active.id, p)}
          />
        )}
      </div>
    </div>
  );
}

function ExplanationCard({
  view,
  onOpenFile,
  onPin,
  isPinned,
  onUpdate,
}: {
  view: ExplanationView;
  onOpenFile: (path: string, line?: number) => void;
  onPin: () => void;
  isPinned: boolean;
  onUpdate: (partial: Partial<ExplanationView>) => void;
}) {
  const [followup, setFollowup] = useState('');
  const [sending, setSending] = useState(false);

  const sendFollowup = async () => {
    if (!view.annotation || !followup.trim()) return;
    const q = followup.trim();
    setFollowup('');
    setSending(true);
    const current = view.conversation || [];
    onUpdate({
      conversation: [
        ...current,
        {
          id: Date.now(),
          annotation_id: view.annotation.id,
          role: 'user',
          content: q,
          created_at: new Date().toISOString(),
        },
      ],
    });
    try {
      const res = await api.ai.followup(view.annotation.id, q);
      onUpdate({
        conversation: [
          ...current,
          {
            id: Date.now(),
            annotation_id: view.annotation.id,
            role: 'user',
            content: q,
            created_at: new Date().toISOString(),
          },
          {
            id: Date.now() + 1,
            annotation_id: view.annotation.id,
            role: 'assistant',
            content: res.response,
            created_at: new Date().toISOString(),
          },
        ],
      });
    } catch (e: any) {
      onUpdate({
        conversation: [
          ...current,
          {
            id: Date.now(),
            annotation_id: view.annotation.id,
            role: 'user',
            content: q,
            created_at: new Date().toISOString(),
          },
          {
            id: Date.now() + 1,
            annotation_id: view.annotation.id,
            role: 'assistant',
            content: `**Error:** ${e.message}`,
            created_at: new Date().toISOString(),
          },
        ],
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-mono text-ink-400">
          <button
            className="text-blue-400 hover:underline"
            onClick={() => onOpenFile(view.filePath, view.startLine)}
          >
            {view.filePath}:{view.startLine}-{view.endLine}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPin}
            className={`text-[10px] px-2 py-0.5 rounded border ${
              isPinned
                ? 'border-amber-500 text-amber-300'
                : 'border-ink-700 text-ink-400 hover:text-ink-200'
            }`}
          >
            {isPinned ? '★ pinned' : '☆ pin'}
          </button>
          <button
            onClick={() => onUpdate({ rating: view.rating === 'up' ? undefined : 'up' })}
            className={view.rating === 'up' ? 'text-emerald-400' : 'text-ink-500 hover:text-ink-200'}
            title="Helpful"
          >
            👍
          </button>
          <button
            onClick={() => onUpdate({ rating: view.rating === 'down' ? undefined : 'down' })}
            className={view.rating === 'down' ? 'text-red-400' : 'text-ink-500 hover:text-ink-200'}
            title="Not helpful"
          >
            👎
          </button>
        </div>
      </div>

      <div className="bg-ink-950 border border-ink-800 rounded p-2 mb-3">
        <pre className="text-[11px] text-ink-400 font-mono whitespace-pre-wrap max-h-24 overflow-auto">
          {view.selectedText}
        </pre>
      </div>

      <div className="markdown">
        {view.loading ? (
          <div className="text-ink-500 italic flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            Asking Claude…
          </div>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: (props) => {
                const href = props.href || '';
                const fileLink = href.match(/^([^:]+):(\d+)$/);
                if (fileLink) {
                  return (
                    <a
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenFile(fileLink[1], Number(fileLink[2]));
                      }}
                      href="#"
                    >
                      {props.children}
                    </a>
                  );
                }
                return <a {...props} target="_blank" rel="noreferrer" />;
              },
            }}
          >
            {view.body}
          </ReactMarkdown>
        )}
      </div>

      {view.conversation && view.conversation.length > 0 && (
        <div className="mt-4 border-t border-ink-800 pt-3 space-y-3">
          {view.conversation.map((m) => (
            <div key={m.id}>
              <div
                className={`text-[10px] uppercase tracking-wider mb-1 ${
                  m.role === 'user' ? 'text-blue-400' : 'text-emerald-400'
                }`}
              >
                {m.role === 'user' ? 'You' : 'Claude'}
              </div>
              <div className="markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}

      {view.annotation && (
        <div className="mt-4 border-t border-ink-800 pt-3">
          <div className="flex gap-2">
            <input
              value={followup}
              onChange={(e) => setFollowup(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendFollowup()}
              placeholder="Ask a follow-up…"
              disabled={sending}
              className="flex-1 px-2 py-1.5 rounded bg-ink-800 border border-ink-700 text-xs"
            />
            <button
              onClick={sendFollowup}
              disabled={sending || !followup.trim()}
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-ink-700 text-white text-xs"
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {!view.annotation && !view.loading && (
        <div className="mt-3 text-[10px] text-ink-500">
          Tip: Use the <em>Highlight</em> toolbar action to save this and enable follow-ups.
        </div>
      )}
    </div>
  );
}
