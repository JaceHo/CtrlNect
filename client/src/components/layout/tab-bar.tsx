import { X, MessageSquare, Clock, SquareTerminal, MessageCircle } from "lucide-react";

export type TabType = "session" | "cron" | "iterm" | "wechat";

export interface AppTab {
  id: string;    // deterministic: `${type}:${itemId}`
  type: TabType;
  itemId: string;
  label: string;
}

function TabIcon({ type }: { type: TabType }) {
  if (type === "cron") return <Clock size={11} />;
  if (type === "iterm") return <SquareTerminal size={11} />;
  if (type === "wechat") return <MessageCircle size={11} />;
  return <MessageSquare size={11} />;
}

interface TabBarProps {
  tabs: AppTab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export function TabBar({ tabs, activeTabId, onSelect, onClose }: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div
      className="flex items-center border-b border-border bg-bg-secondary/40 overflow-x-auto flex-shrink-0"
      style={{ scrollbarWidth: "none" }}
    >
      {tabs.map((tab) => {
        const active = activeTabId === tab.id;
        return (
          <div
            key={tab.id}
            className={`group flex items-center gap-1.5 px-3 py-2 cursor-pointer border-r border-border/60 flex-shrink-0 text-xs transition-colors select-none ${
              active
                ? "bg-bg-primary text-text-primary border-b-2 border-b-blue-500 -mb-px"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
            onClick={() => onSelect(tab.id)}
          >
            <span className={active ? "text-blue-400" : "text-text-muted"}>
              <TabIcon type={tab.type} />
            </span>
            <span className="max-w-[150px] truncate">{tab.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-400 transition-all ml-0.5 flex-shrink-0"
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
