import { useStore } from '../lib/store';

export function TabBar() {
  const tabs = useStore((s) => s.openTabs);
  const active = useStore((s) => s.activeTabPath);
  const setActive = useStore((s) => s.setActiveTab);
  const close = useStore((s) => s.closeTab);
  const closeOthers = useStore((s) => s.closeOthers);

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-stretch bg-ink-900 border-b border-ink-800 overflow-x-auto">
      {tabs.map((t) => {
        const isActive = t.path === active;
        const parts = t.path.split('/');
        const name = parts[parts.length - 1];
        const folder = parts.slice(0, -1).join('/');
        return (
          <div
            key={t.path}
            className={`group flex items-center gap-2 px-3 py-1.5 border-r border-ink-800 cursor-pointer text-xs whitespace-nowrap ${
              isActive
                ? 'bg-ink-950 text-ink-100'
                : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200'
            }`}
            onClick={() => setActive(t.path)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (confirm('Close other tabs?')) closeOthers(t.path);
            }}
            title={t.path}
          >
            <span className="font-mono">{name}</span>
            {folder && <span className="text-[10px] text-ink-500 font-mono">{folder}</span>}
            <button
              className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-red-400 ml-1"
              onClick={(e) => {
                e.stopPropagation();
                close(t.path);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
