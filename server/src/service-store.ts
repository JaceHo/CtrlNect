import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(import.meta.dir, "../../data");
const LOGS_DIR = join(DATA_DIR, "service-logs");
const SERVICES_FILE = join(DATA_DIR, "services.json");

export type ServiceStatus = "running" | "stopped" | "error" | "unknown";

export interface SystemService {
  id: string;
  name: string;
  description?: string;
  command: string;
  cwd?: string;
  logPath?: string;
  status: ServiceStatus;
  enabled: boolean;
  pid?: number;
  createdAt: string;
  lastStarted?: string;
  lastError?: string;
}

interface ServiceStoreData {
  services: SystemService[];
}

function loadServices(): ServiceStoreData {
  try {
    if (existsSync(SERVICES_FILE)) {
      return JSON.parse(readFileSync(SERVICES_FILE, "utf-8")) as ServiceStoreData;
    }
  } catch {
    // Ignore errors
  }
  return { services: [] };
}

function saveServices(data: ServiceStoreData): void {
  try {
    const dir = DATA_DIR;
    if (!existsSync(dir)) {
      import("fs").then(fs => fs.mkdirSync(dir, { recursive: true }));
    }
    writeFileSync(SERVICES_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[ServiceStore] Failed to save:", err);
  }
}

export class ServiceStore {
  private data: ServiceStoreData;
  private runningProcesses = new Map<string, ReturnType<typeof setInterval>>();

  constructor() {
    this.data = loadServices();
    // Check status of all services on startup
    this.checkAllServices();
  }

  getAll(): SystemService[] {
    return this.data.services;
  }

  get(id: string): SystemService | undefined {
    return this.data.services.find(s => s.id === id);
  }

  create(service: Omit<SystemService, "id" | "status" | "createdAt">): SystemService {
    const newService: SystemService = {
      ...service,
      enabled: service.enabled ?? true,
      id: crypto.randomUUID(),
      status: "unknown",
      createdAt: new Date().toISOString(),
    };
    this.data.services.push(newService);
    saveServices(this.data);
    return newService;
  }

  update(id: string, updates: Partial<SystemService>): SystemService | undefined {
    const idx = this.data.services.findIndex(s => s.id === id);
    if (idx === -1) return undefined;
    this.data.services[idx] = { ...this.data.services[idx], ...updates };
    saveServices(this.data);
    return this.data.services[idx];
  }

  delete(id: string): boolean {
    const idx = this.data.services.findIndex(s => s.id === id);
    if (idx === -1) return false;
    // Stop if running
    this.stopService(id);
    this.data.services.splice(idx, 1);
    saveServices(this.data);
    return true;
  }

  async startService(id: string): Promise<boolean> {
    const service = this.get(id);
    if (!service) return false;

    // Check if service is enabled
    if (service.enabled === false) {
      this.update(id, { lastError: "Service is disabled" });
      return false;
    }

    try {
      const { spawn } = await import("child_process");

      // Ensure logs directory exists
      if (!existsSync(LOGS_DIR)) {
        mkdirSync(LOGS_DIR, { recursive: true });
      }

      // Determine log path - use service-specific log or create default
      const logPath = service.logPath || join(LOGS_DIR, `${service.name}.log`);

      // Ensure log file exists
      if (!existsSync(logPath)) {
        writeFileSync(logPath, "", "utf-8");
      }

      // Append start marker to log
      const startMarker = `[${new Date().toISOString()}] Starting: ${service.command}\n`;
      appendFileSync(logPath, startMarker, "utf-8");

      // Wrap command to redirect output to log file (works for both long-running and short-lived commands)
      const wrappedCommand = `${service.command} >> "${logPath}" 2>> "${logPath}"`;

      // Start the process - use shell redirection for reliable output capture
      const proc = spawn("sh", ["-c", wrappedCommand], {
        cwd: service.cwd || process.cwd(),
        detached: true,
        stdio: "ignore",
      });

      proc.unref();
      const pid = proc.pid;

      // Update service status with log path
      this.update(id, {
        status: "running",
        pid,
        logPath: logPath,
        lastStarted: new Date().toISOString(),
        lastError: undefined,
      });

      console.log(`[ServiceStore] Started service ${service.name} with PID ${pid}, log: ${logPath}`);
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.update(id, { status: "error", lastError: error });
      console.error(`[ServiceStore] Failed to start ${service.name}:`, error);
      return false;
    }
  }

  stopService(id: string): boolean {
    const service = this.get(id);
    if (!service || !service.pid) return false;

    try {
      process.kill(service.pid, "SIGTERM");
      this.update(id, { status: "stopped", pid: undefined });
      console.log(`[ServiceStore] Stopped service ${service.name}`);
      return true;
    } catch (err) {
      // Process might already be gone
      this.update(id, { status: "unknown", pid: undefined });
      return false;
    }
  }

  restartService(id: string): Promise<boolean> {
    this.stopService(id);
    return this.startService(id);
  }

  async checkServiceStatus(id: string): Promise<ServiceStatus> {
    const service = this.get(id);
    if (!service) return "unknown";

    if (!service.pid) {
      return "stopped";
    }

    try {
      // Check if process exists
      process.kill(service.pid, 0);
      return "running";
    } catch {
      // Process doesn't exist
      this.update(id, { status: "stopped", pid: undefined });
      return "stopped";
    }
  }

  async checkAllServices(): Promise<void> {
    for (const service of this.data.services) {
      if (service.pid) {
        const status = await this.checkServiceStatus(service.id);
        if (status !== service.status) {
          this.update(service.id, { status });
        }
      }
    }
  }

  getServiceLogs(id: string, lines: number = 100): string {
    const service = this.get(id);
    if (!service) return "";

    let logPath = service.logPath;

    // Try default log locations if no logPath specified
    if (!logPath) {
      const possiblePaths = [
        join(LOGS_DIR, `${service.name}.log`),
        `/var/log/${service.name}.log`,
        `/var/log/${service.name}`,
        join(process.cwd(), `${service.name}.log`),
        join(process.env.HOME || "", `.local/share/${service.name}/logs`),
      ];
      for (const p of possiblePaths) {
        if (existsSync(p)) {
          logPath = p;
          break;
        }
      }
    }

    if (!logPath) {
      return `[No log file found for ${service.name}]\n\nLog will be created at:\n${join(LOGS_DIR, `${service.name}.log`)}\n\nStart the service to generate logs.`;
    }

    try {
      const content = readFileSync(logPath, "utf-8");
      const allLines = content.split("\n");
      return allLines.slice(-lines).join("\n");
    } catch {
      return `[Cannot read log file: ${logPath}]`;
    }
  }

  // Discover services from common locations
  async discoverServices(): Promise<Omit<SystemService, "id" | "status" | "createdAt">[]> {
    const discovered: Omit<SystemService, "id" | "status" | "createdAt">[] = [];

    // Check systemd services
    try {
      const { exec } = await import("child_process");
      const result = await new Promise<string>((resolve) => {
        exec("systemctl list-units --type=service --all --no-pager --plain -o json", (err, stdout) => {
          resolve(stdout || "[]");
        });
      });

      const units = JSON.parse(result) as Array<{
        UnitName?: string;
        Description?: string;
        ActiveState?: string;
      }>;

      for (const unit of units.slice(0, 20)) {
        if (unit.UnitName && unit.UnitName !== "session-.scope") {
          discovered.push({
            name: unit.UnitName.replace(".service", ""),
            description: unit.Description || "",
            command: `systemctl start ${unit.UnitName}`,
            logPath: `/var/log/${unit.UnitName.replace(".service", ".log")}`,
          });
        }
      }
    } catch {
      // Ignore - might not have systemctl
    }

    return discovered;
  }
}
