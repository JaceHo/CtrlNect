import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle, XCircle, Loader2, Play, Clock, Zap } from "lucide-react";
import type { CronJob, CronRunLog, Session } from "@webclaude/shared";

interface CronLogViewProps {
  cron: CronJob;
  sessions: Session[];
  onBack: () => void;
  onTrigger: (id: string) => Promise<void>;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "running...";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function StatusIcon({ status }: { status: CronRunLog["status"] }) {
  if (status === "success") return <CheckCircle size={14} className="text-green-400" />;
  if (status === "error") return <XCircle size={14} className="text-red-400" />;
  return <Loader2 size={14} className="text-yellow-400 animate-spin" />;
}

export function CronLogView({ cron, sessions, onBack, onTrigger }: CronLogViewProps) {
  const [logs, setLogs] = useState<CronRunLog[]>([]);
  const [loading, setLoading] = useState(true);

  const sessionName = sessions.find((s) => s.id === cron.sessionId)?.title ?? "Unknown";

  useEffect(() => {
    setLoading(true);
    fetch(`/api/crons/${cron.id}/logs`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [cron.id]);

  // Refresh logs when cron status changes (e.g. run completes)
  useEffect(() => {
    if (cron.lastRun) {
      fetch(`/api/crons/${cron.id}/logs`)
        .then((r) => r.json())
        .then((data) => setLogs(data))
        .catch(() => {});
    }
  }, [cron.id, cron.lastRun, cron.status]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button
          onClick={onBack}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium text-text-primary truncate">{cron.name}</h2>
          <div className="flex items-center gap-3 text-[11px] text-text-muted">
            <span className="font-mono">{cron.schedule}</span>
            <span>Session: {sessionName}</span>
            {cron.nextRun && (
              <span>Next: {formatDateTime(cron.nextRun)}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => onTrigger(cron.id)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-bg-secondary border border-border rounded-md hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
        >
          <Play size={12} />
          Run Now
        </button>
      </div>

      {/* Prompt preview */}
      <div className="px-4 py-2.5 border-b border-border bg-bg-secondary/50">
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Prompt</div>
        <div className="text-xs text-text-secondary line-clamp-2">{cron.prompt}</div>
      </div>

      {/* Log list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-text-muted">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-2">
            <Clock size={24} className="opacity-50" />
            <p className="text-sm">No runs yet</p>
            <p className="text-xs">Trigger a run or wait for the schedule</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <div key={log.id} className="px-4 py-3 hover:bg-bg-hover/50 transition-colors">
                <div className="flex items-center gap-2">
                  <StatusIcon status={log.status} />
                  <span className="text-xs text-text-primary font-medium">
                    {log.status === "success" ? "Success" : log.status === "error" ? "Failed" : "Running"}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-text-muted">
                    {log.trigger === "manual" ? (
                      <><Zap size={10} /> Manual</>
                    ) : (
                      <><Clock size={10} /> Scheduled</>
                    )}
                  </span>
                  <span className="ml-auto text-[11px] text-text-muted">
                    {formatDuration(log.startedAt, log.endedAt)}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-text-muted">
                  {formatDateTime(log.startedAt)}
                </div>
                {log.error && (
                  <div className="mt-1.5 px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 font-mono">
                    {log.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
