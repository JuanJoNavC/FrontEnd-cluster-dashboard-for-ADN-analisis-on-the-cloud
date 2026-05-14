"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardSnapshot } from "@/features/dashboard/types";
import { mockDashboardSnapshot } from "@/features/dashboard/mockData";

interface UseDashboardResult {
  snapshot: DashboardSnapshot;
  source: "redis" | "mock";
  loading: boolean;
  error: string | null;
  lastFetchedAt: Date | null;
  refresh: () => void;
}

const POLL_INTERVAL_MS = 5000; // 5 segundos

export function useDashboardSnapshot(runId: string): UseDashboardResult {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(mockDashboardSnapshot);
  const [source, setSource] = useState<"redis" | "mock">("mock");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSnapshot = async (signal?: AbortSignal) => {
    try {
      const res = await fetch(
        `/api/dashboard/snapshot?runId=${encodeURIComponent(runId)}`,
        { signal, cache: "no-store" }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setSnapshot(data.snapshot);
      setSource(data.source);
      setError(null);
      setLastFetchedAt(new Date());
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    fetchSnapshot(ctrl.signal);
  };

  useEffect(() => {
    // Fetch inicial
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    fetchSnapshot(ctrl.signal);

    // Polling
    const interval = setInterval(() => {
      const pollCtrl = new AbortController();
      abortRef.current = pollCtrl;
      fetchSnapshot(pollCtrl.signal);
    }, POLL_INTERVAL_MS);

    return () => {
      ctrl.abort();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return { snapshot, source, loading, error, lastFetchedAt, refresh };
}
