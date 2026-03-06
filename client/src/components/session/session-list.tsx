import type { Session } from "@webclaude/shared";
import { SessionItem } from "./session-item";
import { FeishuIcon } from "@/components/icons/feishu-icon";

interface SessionListProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Small section label divider */
function SectionLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 pt-3 pb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-text-muted font-medium select-none">
      {children}
    </div>
  );
}

export function SessionList({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
}: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="p-4 text-center text-text-muted text-sm">
        No sessions yet
      </div>
    );
  }

  const feishuSessions = sessions.filter((s) => !!s.feishuDmInfo);
  const regularSessions = sessions.filter((s) => !s.feishuDmInfo);

  const renderItem = (session: Session) => (
    <SessionItem
      key={session.id}
      session={session}
      isActive={session.id === activeSessionId}
      onSelect={() => onSelect(session.id)}
      onDelete={() => onDelete(session.id)}
    />
  );

  return (
    <div className="py-1">
      {/* ── Feishu DM sessions ── */}
      {feishuSessions.length > 0 && (
        <>
          <SectionLabel>
            <FeishuIcon size={10} />
            Feishu DMs
          </SectionLabel>
          {feishuSessions.map(renderItem)}
        </>
      )}

      {/* ── Regular Claude sessions ── */}
      {regularSessions.length > 0 && (
        <>
          {feishuSessions.length > 0 && (
            <SectionLabel>Sessions</SectionLabel>
          )}
          {regularSessions.map(renderItem)}
        </>
      )}
    </div>
  );
}
