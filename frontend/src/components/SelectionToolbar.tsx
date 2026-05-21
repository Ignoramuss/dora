import { useState } from 'react';

export type SelectionAction =
  | { kind: 'explain' }
  | { kind: 'syntax' }
  | { kind: 'trace' }
  | { kind: 'highlight'; color: string; note?: string }
  | { kind: 'ask'; question: string };

type Props = {
  x: number;
  y: number;
  onAction: (a: SelectionAction) => void;
  onDismiss: () => void;
};

const COLORS = [
  { name: 'yellow', bg: 'bg-yellow-400/70' },
  { name: 'green', bg: 'bg-emerald-400/70' },
  { name: 'blue', bg: 'bg-blue-400/70' },
  { name: 'pink', bg: 'bg-pink-400/70' },
];

export function SelectionToolbar({ x, y, onAction, onDismiss }: Props) {
  const [askOpen, setAskOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [note, setNote] = useState('');
  const [color, setColor] = useState('yellow');

  return (
    <div
      className="absolute z-50 bg-ink-900 border border-ink-700 rounded-lg shadow-2xl p-1.5 flex flex-col gap-1"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {!askOpen && !highlightOpen && (
        <div className="flex items-center gap-1">
          <ToolbarButton onClick={() => onAction({ kind: 'explain' })}>
            ✦ Explain
          </ToolbarButton>
          <ToolbarButton onClick={() => onAction({ kind: 'syntax' })}>
            Syntax?
          </ToolbarButton>
          <ToolbarButton onClick={() => onAction({ kind: 'trace' })}>
            Trace
          </ToolbarButton>
          <ToolbarButton onClick={() => setHighlightOpen(true)}>
            Highlight
          </ToolbarButton>
          <ToolbarButton onClick={() => setAskOpen(true)}>
            Ask…
          </ToolbarButton>
          <button
            className="ml-1 px-1 py-1 text-ink-500 hover:text-ink-200"
            onClick={onDismiss}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {highlightOpen && (
        <div className="flex flex-col gap-2 min-w-[260px]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ink-400">Color:</span>
            {COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => setColor(c.name)}
                className={`w-5 h-5 rounded ${c.bg} ${
                  color === c.name ? 'ring-2 ring-blue-400' : ''
                }`}
                title={c.name}
              />
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note…"
            className="w-full px-2 py-1.5 rounded bg-ink-800 border border-ink-700 text-xs"
            rows={2}
          />
          <div className="flex gap-2 justify-end">
            <button
              className="text-xs px-2 py-1 text-ink-400 hover:text-ink-100"
              onClick={() => setHighlightOpen(false)}
            >
              Cancel
            </button>
            <button
              className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
              onClick={() => onAction({ kind: 'highlight', color, note: note.trim() || undefined })}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {askOpen && (
        <div className="flex flex-col gap-2 min-w-[300px]">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about this selection…"
            className="w-full px-2 py-1.5 rounded bg-ink-800 border border-ink-700 text-xs"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              className="text-xs px-2 py-1 text-ink-400 hover:text-ink-100"
              onClick={() => setAskOpen(false)}
            >
              Cancel
            </button>
            <button
              className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white"
              disabled={!question.trim()}
              onClick={() => question.trim() && onAction({ kind: 'ask', question: question.trim() })}
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 text-xs rounded text-ink-200 hover:bg-blue-600 hover:text-white whitespace-nowrap"
    >
      {children}
    </button>
  );
}
