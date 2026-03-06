import { useState, useEffect, useCallback } from "react";

export interface SystemService {
  id: string;
  name: string;
  description: string;
  command: string;
  cwd?: string;
  logPath?: string;
  status: "running" | "stopped" | "error" | "unknown";
  pid?: number;
  createdAt: string;
  lastStarted?: string;
  lastError?: string;
}

export interface DiscoveredService {
  name: string;
  description: string;
  command: string;
  logPath?: string;
}

export function useServices() {
  const [services, setServices] = useState<SystemService[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch("/api/services");
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch (err) {
      console.error("[Services] Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
    // Refresh every 10 seconds
    const interval = setInterval(fetchServices, 10000);
    return () => clearInterval(interval);
  }, [fetchServices]);

  const createService = useCallback(async (service: {
    name: string;
    description?: string;
    command: string;
    cwd?: string;
    logPath?: string;
  }) => {
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(service),
    });
    if (res.ok) {
      await fetchServices();
    }
    return res.ok;
  }, [fetchServices]);

  const deleteService = useCallback(async (id: string) => {
    const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
    if (res.ok) {
      setServices((prev) => prev.filter((s) => s.id !== id));
    }
    return res.ok;
  }, []);

  const startService = useCallback(async (id: string) => {
    const res = await fetch(`/api/services/${id}/start`, { method: "POST" });
    if (res.ok) {
      await fetchServices();
    }
    return res.ok;
  }, [fetchServices]);

  const stopService = useCallback(async (id: string) => {
    const res = await fetch(`/api/services/${id}/stop`, { method: "POST" });
    if (res.ok) {
      await fetchServices();
    }
    return res.ok;
  }, [fetchServices]);

  const restartService = useCallback(async (id: string) => {
    const res = await fetch(`/api/services/${id}/restart`, { method: "POST" });
    if (res.ok) {
      await fetchServices();
    }
    return res.ok;
  }, [fetchServices]);

  const getServiceLogs = useCallback(async (id: string, lines: number = 100): Promise<string> => {
    const res = await fetch(`/api/services/${id}/logs?lines=${lines}`);
    if (res.ok) {
      return res.text();
    }
    return "";
  }, []);

  const discoverServices = useCallback(async (): Promise<DiscoveredService[]> => {
    const res = await fetch("/api/services/discover");
    if (res.ok) {
      return res.json();
    }
    return [];
  }, []);

  return {
    services,
    loading,
    createService,
    deleteService,
    startService,
    stopService,
    restartService,
    getServiceLogs,
    discoverServices,
    refreshServices: fetchServices,
  };
}
