import { useState, useEffect, useCallback } from "react";
import type { CronJob, CreateCronRequest, UpdateCronRequest } from "@webclaude/shared";
import { useWSListener } from "./use-websocket";

export function useCrons() {
  const [crons, setCrons] = useState<CronJob[]>([]);

  useEffect(() => {
    fetch("/api/crons")
      .then((r) => r.json())
      .then((data) => setCrons(data))
      .catch(() => {});
  }, []);

  useWSListener(
    useCallback((msg: { type: string; cron?: CronJob; crons?: CronJob[] }) => {
      if (msg.type === "cron_update" && msg.cron) {
        setCrons((prev) => {
          const idx = prev.findIndex((c) => c.id === msg.cron!.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = msg.cron!;
            return next;
          }
          return [msg.cron!, ...prev];
        });
      } else if (msg.type === "cron_list" && msg.crons) {
        setCrons(msg.crons);
      }
    }, []),
  );

  const createCron = useCallback(async (req: CreateCronRequest) => {
    const res = await fetch("/api/crons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return (await res.json()) as CronJob;
  }, []);

  const updateCron = useCallback(async (id: string, req: UpdateCronRequest) => {
    const res = await fetch(`/api/crons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return (await res.json()) as CronJob;
  }, []);

  const deleteCron = useCallback(async (id: string) => {
    await fetch(`/api/crons/${id}`, { method: "DELETE" });
    setCrons((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const triggerCron = useCallback(async (id: string) => {
    await fetch(`/api/crons/${id}/trigger`, { method: "POST" });
  }, []);

  return { crons, createCron, updateCron, deleteCron, triggerCron };
}
