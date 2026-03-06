import { useState } from "react";
import { Terminal, Play, Square, RotateCcw, Trash2, ChevronDown, ChevronRight, FileText, Plus, Search, Loader2 } from "lucide-react";
import type { SystemService, DiscoveredService } from "@/hooks/use-services";

interface ServicePanelProps {
  services: SystemService[];
  onStart: (id: string) => Promise<boolean>;
  onStop: (id: string) => Promise<boolean>;
  onRestart: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onCreate: (service: { name: string; description?: string; command: string; cwd?: string; logPath?: string }) => Promise<boolean>;
  onGetLogs: (id: string) => Promise<string>;
  onDiscover: () => Promise<DiscoveredService[]>;
}

export function ServicePanel({
  services,
  onStart,
  onStop,
  onRestart,
  onDelete,
  onCreate,
  onGetLogs,
  onDiscover,
}: ServicePanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [logsContent, setLogsContent] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredService[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [newService, setNewService] = useState({ name: "", description: "", command: "", cwd: "", logPath: "" });

  const runningCount = services.filter(s => s.status === "running").length;

  const handleViewLogs = async (id: string) => {
    setLoadingLogs(true);
    setShowLogs(id);
    const logs = await onGetLogs(id);
    setLogsContent(logs);
    setLoadingLogs(false);
  };

  const handleDiscover = async () => {
    setLoadingDiscover(true);
    setShowDiscover(true);
    const result = await onDiscover();
    setDiscovered(result);
    setLoadingDiscover(false);
  };

  const handleAddDiscovered = async (service: DiscoveredService) => {
    await onCreate(service);
    setDiscovered(prev => prev.filter(d => d.name !== service.name));
  };

  const handleCreate = async () => {
    if (!newService.name || !newService.command) return;
    await onCreate(newService);
    setNewService({ name: "", description: "", command: "", cwd: "", logPath: "" });
    setShowAdd(false);
  };

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Terminal size={12} />
        <span>Services</span>
        {runningCount > 0 && <span className="text-green-400">({runningCount})</span>}
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-1">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg-hover group"
            >
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                service.status === "running" ? "bg-green-400" :
                service.status === "error" ? "bg-red-400" : "bg-text-muted"
              }`} />
              <span className="flex-1 text-xs text-text-primary truncate">{service.name}</span>
              <div className="hidden group-hover:flex items-center gap-0.5">
                <button
                  onClick={() => handleViewLogs(service.id)}
                  className="p-1 rounded text-text-muted hover:text-text-primary"
                  title="Logs"
                >
                  <FileText size={11} />
                </button>
                {service.status === "running" ? (
                  <button
                    onClick={() => onStop(service.id)}
                    className="p-1 rounded text-text-muted hover:text-red-400"
                    title="Stop"
                  >
                    <Square size={11} />
                  </button>
                ) : (
                  <button
                    onClick={() => onStart(service.id)}
                    className="p-1 rounded text-text-muted hover:text-green-400"
                    title="Start"
                  >
                    <Play size={11} />
                  </button>
                )}
                <button
                  onClick={() => onRestart(service.id)}
                  className="p-1 rounded text-text-muted hover:text-yellow-400"
                  title="Restart"
                >
                  <RotateCcw size={11} />
                </button>
                <button
                  onClick={() => onDelete(service.id)}
                  className="p-1 rounded text-text-muted hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}

          {showAdd ? (
            <div className="p-2 bg-bg-tertiary rounded-md space-y-2">
              <input
                value={newService.name}
                onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                placeholder="Name"
                className="w-full px-2 py-1 bg-bg-secondary border border-border rounded text-xs"
              />
              <input
                value={newService.command}
                onChange={(e) => setNewService({ ...newService, command: e.target.value })}
                placeholder="Command"
                className="w-full px-2 py-1 bg-bg-secondary border border-border rounded text-xs font-mono"
              />
              <div className="flex gap-1">
                <button onClick={handleCreate} className="flex-1 px-2 py-1 bg-accent text-bg-primary rounded text-xs">Add</button>
                <button onClick={() => setShowAdd(false)} className="px-2 py-1 bg-bg-tertiary text-text-muted rounded text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-1 pt-1">
              <button
                onClick={() => setShowAdd(true)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary bg-bg-tertiary/50 rounded hover:bg-bg-hover"
              >
                <Plus size={10} /> Add
              </button>
              <button
                onClick={handleDiscover}
                className="flex items-center justify-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary bg-bg-tertiary/50 rounded hover:bg-bg-hover"
                title="Discover services"
              >
                <Search size={10} />
              </button>
            </div>
          )}

          {showDiscover && (
            <div className="p-2 bg-bg-tertiary rounded-md">
              {loadingDiscover ? (
                <div className="flex items-center gap-2 text-text-muted text-xs">
                  <Loader2 size={12} className="animate-spin" /> Scanning...
                </div>
              ) : discovered.length > 0 ? (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {discovered.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <span className="truncate">{s.name}</span>
                      <button onClick={() => handleAddDiscovered(s)} className="p-1 text-green-400 hover:bg-green-400/10 rounded">
                        <Plus size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-text-muted">No services found</span>
              )}
              <button onClick={() => setShowDiscover(false)} className="mt-1 text-xs text-text-muted hover:text-text-primary">
                Close
              </button>
            </div>
          )}
        </div>
      )}

      {showLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowLogs(null)} />
          <div className="relative w-[600px] max-h-[60vh] bg-bg-secondary rounded-xl border border-border shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium">Service Logs</h3>
              <button onClick={() => setShowLogs(null)} className="p-1 rounded text-text-muted hover:text-text-primary">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {loadingLogs ? (
                <div className="flex items-center gap-2 text-text-muted">
                  <Loader2 size={14} className="animate-spin" /> Loading...
                </div>
              ) : (
                <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap">{logsContent || "No logs"}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
