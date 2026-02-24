"use client";

import { useState, useCallback } from "react";

export type DatePreset = "today" | "last_7_days" | "last_30_days" | "this_month" | "last_month" | "custom";

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  switch (preset) {
    case "today":
      return { from: fmt(today), to: fmt(today) };
    case "last_7_days": {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      return { from: fmt(d), to: fmt(today) };
    }
    case "last_30_days": {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      return { from: fmt(d), to: fmt(today) };
    }
    case "this_month":
      return { from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`, to: fmt(today) };
    case "last_month": {
      const y = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
      const m = today.getMonth() === 0 ? 12 : today.getMonth();
      const lastDay = new Date(y, m, 0).getDate();
      return {
        from: `${y}-${String(m).padStart(2, "0")}-01`,
        to: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      };
    }
    case "custom":
      return { from: fmt(today), to: fmt(today) };
  }
}

export function useAnalyticsFilters() {
  const [preset, setPresetState] = useState<DatePreset>("last_30_days");
  const [from, setFrom] = useState(() => getDateRange("last_30_days").from);
  const [to, setTo] = useState(() => getDateRange("last_30_days").to);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);

  const setPreset = useCallback((p: DatePreset) => {
    setPresetState(p);
    if (p !== "custom") {
      const range = getDateRange(p);
      setFrom(range.from);
      setTo(range.to);
    }
    setStatuses([]);
    setServices([]);
  }, []);

  const setCustomRange = useCallback((newFrom: string, newTo: string) => {
    setPresetState("custom");
    setFrom(newFrom);
    setTo(newTo);
  }, []);

  const toggleStatus = useCallback((status: string) => {
    setStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }, []);

  const toggleService = useCallback((serviceId: string) => {
    setServices((prev) =>
      prev.includes(serviceId) ? prev.filter((s) => s !== serviceId) : [...prev, serviceId]
    );
  }, []);

  return {
    preset,
    from,
    to,
    statuses,
    services,
    setPreset,
    setCustomRange,
    toggleStatus,
    toggleService,
  };
}
