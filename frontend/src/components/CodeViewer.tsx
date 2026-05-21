import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { highlightToLines } from '../lib/shiki';
import { useStore } from '../lib/store';
import { api, Annotation } from '../lib/api';
import { SelectionAction, SelectionToolbar } from './SelectionToolbar';

type Selection = {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  text: string;
  x: number;
  y: number;
};

type Props = {
  repoId: number;
  filePath: string;
  content: string;
  language: string;
  onAction: (
    action: SelectionAction,
    payload: {
      startLine: number;
      startCol: number;
      endLine: number;
      endCol: number;
      selectedText: string;
    }
  ) => void;
  annotations: Annotation[];
  reloadAnnotations: () => void;
};

export function CodeViewer({
  repoId,
  filePath,
  content,
  language,
  onAction,
  annotations,
  reloadAnnotations,
}: Props) {
  const theme = useStore((s) => s.theme);
  const [lines, setLines] = useState<string[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const rawLines = useMemo(() => content.split('\n'), [content]);

  useEffect(() => {
    let cancelled = false;
    highlightToLines(content, language, theme).then((html) => {
      if (!cancelled) setLines(html);
    });
    return () => {
      cancelled = true;
    };
  }, [content, language, theme]);

  const lineHighlights = useMemo(() => {
    const map = new Map<number, Annotation[]>();
    for (const a of annotations) {
      for (let l = a.start_line; l <= a.end_line; l++) {
        const list = map.get(l) || [];
        list.push(a);
        map.set(l, list);
      }
    }
    return map;
  }, [annotations]);

  const handleMouseUp = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const text = sel.toString();
      if (!text.trim()) {
        setSelection(null);
        return;
      }
      const container = containerRef.current;
      if (!container || !container.contains(range.startContainer) || !container.contains(range.endContainer)) {
        return;
      }

      const startInfo = getLineColFromNode(range.startContainer, range.startOffset);
      const endInfo = getLineColFromNode(range.endContainer, range.endOffset);
      if (!startInfo || !endInfo) {
        setSelection(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      const cRect = container.getBoundingClientRect();
      setSelection({
        startLine: startInfo.line,
        startCol: startInfo.col,
        endLine: endInfo.line,
        endCol: endInfo.col,
        text,
        x: Math.min(rect.left - cRect.left + container.scrollLeft + 8, container.clientWidth - 340),
        y: rect.bottom - cRect.top + container.scrollTop + 6,
      });
    }, 0);
  }, []);

  const dismiss = () => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const onToolbarAction = async (a: SelectionAction) => {
    if (!selection) return;
    const payload = {
      startLine: selection.startLine,
      startCol: selection.startCol,
      endLine: selection.endLine,
      endCol: selection.endCol,
      selectedText: selection.text,
    };
    if (a.kind === 'highlight') {
      await api.annotations.create({
        repoId,
        filePath,
        startLine: payload.startLine,
        startCol: payload.startCol,
        endLine: payload.endLine,
        endCol: payload.endCol,
        selectedText: payload.selectedText,
        color: a.color,
        userNote: a.note,
      });
      reloadAnnotations();
      dismiss();
      return;
    }
    onAction(a, payload);
    dismiss();
  };

  return (
    <div className="relative h-full overflow-auto bg-ink-950" ref={containerRef} onMouseUp={handleMouseUp}>
      <div className="py-3 shiki-wrapper">
        {rawLines.map((_, i) => {
          const lineNo = i + 1;
          const anns = lineHighlights.get(lineNo) || [];
          const primary = anns[0];
          const hlClass = primary
            ? `highlight-${primary.color}${primary.ai_explanation ? ' has-explanation' : ''}`
            : '';
          const tooltip = primary
            ? [primary.user_note, primary.ai_explanation?.slice(0, 200)].filter(Boolean).join(' — ')
            : '';
          return (
            <div key={i} className="code-line" data-line={lineNo}>
              <div className="line-number">{lineNo}</div>
              <div
                className={`line-content ${hlClass}`}
                title={tooltip}
                dangerouslySetInnerHTML={{
                  __html: lines[i] !== undefined ? lines[i] : escapeHtml(rawLines[i]),
                }}
              />
            </div>
          );
        })}
      </div>
      {selection && (
        <SelectionToolbar
          x={selection.x}
          y={selection.y}
          onAction={onToolbarAction}
          onDismiss={dismiss}
        />
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getLineColFromNode(node: Node, offset: number): { line: number; col: number } | null {
  let el: HTMLElement | null = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  while (el) {
    if (el.classList && el.classList.contains('code-line')) {
      const line = Number(el.getAttribute('data-line'));
      const contentEl = el.querySelector('.line-content');
      if (!contentEl) return { line, col: 0 };
      const col = getOffsetWithin(contentEl, node, offset);
      return { line, col };
    }
    el = el.parentElement;
  }
  return null;
}

function getOffsetWithin(container: Element, target: Node, offsetInTarget: number): number {
  // Walk container's text nodes and accumulate length until target node
  const range = document.createRange();
  range.setStart(container, 0);
  try {
    range.setEnd(target, offsetInTarget);
  } catch {
    return 0;
  }
  return range.toString().length;
}
