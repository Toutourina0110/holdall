"use client";

import { useCallback, useEffect, useState } from "react";

export type ClientJob = {
  id: string;
  type: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  progress: number;
  message: string | null;
  payload: string;
  result: string | null;
  error: string | null;
  createdAt: string | number;
};

export function useJobs(type?: string) {
  const [jobs, setJobs] = useState<ClientJob[]>();
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    const response = await fetch(`/api/jobs${type ? `?type=${encodeURIComponent(type)}` : ""}`);
    if (!response.ok) {
      setError("Jobs could not be loaded. Reload the page to try again.");
      return;
    }
    const data = (await response.json()) as { jobs: ClientJob[] };
    setJobs(data.jobs);
  }, [type]);

  useEffect(() => {
    let active = true;
    fetch(`/api/jobs${type ? `?type=${encodeURIComponent(type)}` : ""}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((data: { jobs: ClientJob[] }) => active && setJobs(data.jobs))
      .catch(() => active && setError("Jobs could not be loaded. Reload the page to try again."));
    const source = new EventSource("/api/jobs/events");
    source.onmessage = (event) => {
      const row = JSON.parse(event.data as string) as ClientJob;
      if (type && row.type !== type) return;
      setJobs((current) => {
        const list = current ?? [];
        const index = list.findIndex((item) => item.id === row.id);
        if (index === -1) return [row, ...list];
        const next = [...list];
        next[index] = row;
        return next;
      });
    };
    return () => {
      active = false;
      source.close();
    };
  }, [type]);

  const act = useCallback(async (id: string, action: "cancel" | "retry") => {
    await fetch(`/api/jobs/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
  }, []);

  return { jobs, error, reload, cancel: (id: string) => act(id, "cancel"), retry: (id: string) => act(id, "retry") };
}
