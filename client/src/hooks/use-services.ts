import { useState, useEffect, useCallback, useRef } from "react";

export interface SystemService {
  id: string;
  name: string;
  description: string;
  command: string;
  cwd?: string;
  logPath?: string;
  status: "running" | "stopped" | "error" | "unknown";
  enabled: boolean;
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
  const lastFetchRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);

  const fetchServices = useCallback(async (force = false) => {
    const now = Date.now();
    // Debounce: don't fetch if we just fetched within 1 second
    if (!force && now - lastFetchRef.current < 1000) {
      return;
    }
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    lastFetchRef.current = now;

    try {
      const res = await fetch("/api/services");
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch (err) {
      console.error("[Services] Failed to fetch:", err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  // Smart polling: check running services more frequently
  useEffect(() => {
    fetchServices(true);

    // Initial fast poll interval for running services
    const interval = setInterval(() => {
      // This will be debounced internally
      fetchServices();
    }, 5000);

    // Full refresh every 30 seconds
    const fullRefresh = setInterval(() => fetchServices(true), 30000);

    return () => {
      clearInterval(interval);
      clearInterval(fullRefresh);
    };
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

  const updateService = useCallback(async (id: string, updates: {
    name?: string;
    description?: string;
    command?: string;
    cwd?: string;
    logPath?: string;
    enabled?: boolean;
  }) => {
    const res = await fetch(`/api/services/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      await fetchServices();
    }
    return res.ok;
  }, [fetchServices]);

  const toggleServiceEnabled = useCallback(async (id: string, enabled: boolean) => {
    return updateService(id, { enabled });
  }, [updateService]);

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
    updateService,
    toggleServiceEnabled,
    deleteService,
    startService,
    stopService,
    restartService,
    getServiceLogs,
    discoverServices,
    refreshServices: fetchServices,
  };
}
