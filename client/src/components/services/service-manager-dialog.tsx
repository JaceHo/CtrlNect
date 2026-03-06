import { useState, useEffect } from "react";
import { X, Play, Square, RotateCcw, Trash2, Terminal, FileText, Loader2, Plus, Search } from "lucide-react";
import type { SystemService, DiscoveredService } from "@/hooks/use-services";

interface ServiceManagerDialogProps {
  services: SystemService[];
  onClose: () => void;
  onStart: (id: string) => Promise<boolean>;
  onStop: (id: string) => Promise<boolean>;
  onRestart: (id: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onCreate: (service: { name: string; description?: string; command: string; cwd?: string; logPath?: string }) => Promise<boolean>;
  onGetLogs: (id: string) => Promise<string>;
  onDiscover: () => Promise<DiscoveredService[]>;
}

export function ServiceManagerDialog({
  services,
  onClose,
  onStart,
  onStop,
  onRestart,
  onDelete,
  onCreate,
  onGetLogs,
  onDiscover,
}: ServiceManagerDialogProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [logsContent, setLogsContent] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [newService, setNewService] = useState({ name: "", description: "", command: "", cwd: "", logPath: "" });
  const [showDiscover, setShowDiscover] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredService[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);

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
    setDiscovered((prev) => prev.filter((d) => d.name !== service.name));
  };

  const handleCreate = async () => {
    if (!newService.name || !newService.command) return;
    await onCreate(newService);
    setNewService({ name: "", description: "", command: "", cwd: "", logPath: "" });
    setShowAdd(false);
  };

  const getStatusColor = (status: SystemService["status"]) => {
    switch (status) {
      case "running": return "text-green-400";
      case "stopped": return "text-text-muted";
      case "error": return "text-red-400";
      default: return "text-yellow-400";
    }
  };

  const getStatusBg = (status: SystemService["status"]) => {
    switch (status) {
      case "running": return "bg-green-400/10";
      case "stopped": return "bg-bg-tertiary/50";
      case "error": return "bg-red-400/10";
      default: return "bg-yellow-400/10";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[700px] max-h-[80vh] bg-bg-secondary rounded-xl border border-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-accent" />
            <h2 className="text-lg font-semibold">Services</h2>
            <span className="text-xs text-text-muted">({services.length})</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-tertiary">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {services.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <Terminal size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No services configured</p>
              <p className="text-xs mt-1">Add a service to manage it here</p>
            </div>
          ) : (
            services.map((service) => (
              <div key={service.id} className={`flex items-center gap-3 p-3 rounded-lg ${getStatusBg(service.status)}`}>
                <div className={`w-2 h-2 rounded-full ${service.status === "running" ? "bg-green-400" : service.status === "error" ? "bg-red-400" : "bg-text-muted"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{service.name}</span>
                    <span className={`text-xs ${getStatusColor(service.status)}`}>{service.status}</span>
                    {service.pid && <span className="text-xs text-text-muted">PID: {service.pid}</span>}
                  </div>
                  <p className="text-xs text-text-muted truncate">{service.description || service.command}</p>
                  {service.lastError && <p className="text-xs text-red-400 truncate">Error: {service.lastError}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleViewLogs(service.id)} className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-tertiary" title="View Logs">
                    <FileText size={14} />
                  </button>
                  {service.status === "running" ? (
                    <button onClick={() => onStop(service.id)} className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10" title="Stop">
                      <Square size={14} />
                    </button>
                  ) : (
                    <button onClick={() => onStart(service.id)} className="p-1.5 rounded-md text-text-muted hover:text-green-400 hover:bg-green-400/10" title="Start">
                      <Play size={14} />
                    </button>
                  )}
                  <button onClick={() => onRestart(service.id)} className="p-1.5 rounded-md text-text-muted hover:text-yellow-400 hover:bg-yellow-400/10" title="Restart">
                    <RotateCcw size={14} />
                  </button>
                  <button onClick={() => onDelete(service.id)} className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border flex gap-2">
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-3 py-2 bg-accent text-bg-primary rounded-lg text-sm font-medium hover:bg-accent-hover">
            <Plus size={14} />
            Add Service
          </button>
          <button onClick={handleDiscover} className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary text-text-secondary rounded-lg text-sm hover:text-text-primary">
            <Search size={14} />
            Discover
          </button>
        </div>

        {showAdd && (
          <div className="p-4 border-t border-border bg-bg-tertiary/50 space-y-3">
            <input value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} placeholder="Service name" className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted" />
            <input value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} placeholder="Description (optional)" className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted" />
            <input value={newService.command} onChange={(e) => setNewService({ ...newService, command: e.target.value })} placeholder="Command to run (e.g., npm run dev)" className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted font-mono" />
            <input value={newService.cwd} onChange={(e) => setNewService({ ...newService, cwd: e.target.value })} placeholder="Working directory (optional)" className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted" />
            <input value={newService.logPath} onChange={(e) => setNewService({ ...newService, logPath: e.target.value })} placeholder="Log file path (optional)" className="w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted" />
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-3 py-2 bg-accent text-bg-primary rounded-lg text-sm font-medium">Create</button>
              <button onClick={() => setShowAdd(false)} className="px-3 py-2 bg-bg-tertiary text-text-muted rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        {showDiscover && (
          <div className="p-4 border-t border-border bg-bg-tertiary/50">
            <h3 className="text-sm font-medium mb-2">Discovered Services</h3>
            {loadingDiscover ? (
              <div className="flex items-center gap-2 text-text-muted">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-sm">Scanning...</span>
              </div>
            ) : discovered.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {discovered.map((s) => (
                  <div key={s.name} className="flex items-center justify-between p-2 bg-bg-secondary rounded-lg">
                    <div>
                      <span className="text-sm font-medium">{s.name}</span>
                      <p className="text-xs text-text-muted truncate">{s.description}</p>
                    </div>
                    <button onClick={() => handleAddDiscovered(s)} className="p-1.5 rounded-md text-green-400 hover:bg-green-400/10">
                      <Plus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No services found</p>
            )}
            <button onClick={() => setShowDiscover(false)} className="mt-2 text-xs text-text-muted hover:text-text-primary">Close</button>
          </div>
        )}
      </div>

      {showLogs && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowLogs(null)} />
          <div className="relative w-[800px] max-h-[70vh] bg-bg-secondary rounded-xl border border-border shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium">Logs</h3>
              <button onClick={() => setShowLogs(null)} className="p-1 rounded text-text-muted hover:text-text-primary">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {loadingLogs ? (
                <div className="flex items-center gap-2 text-text-muted">
                  <Loader2 size={16} className="animate-spin" />
                  Loading logs...
                </div>
              ) : (
                <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap">{logsContent || "No logs available"}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
