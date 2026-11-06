"use client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, KEYS, load, save, type Settings } from "@/lib/storage";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => { setSettings(load(KEYS.settings, DEFAULT_SETTINGS)); }, []);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
  }, [settings.reducedMotion]);
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => { const n = { ...s, ...patch }; save(KEYS.settings, n); return n; });
  }, []);
  return { settings, update };
}

/** Milliseconds for cosmetic animations (0 when reduced motion). */
export function animMs(settings: Settings, base: number): number {
  if (settings.reducedMotion) return 0;
  return settings.fastAnimations ? Math.round(base * 0.35) : base;
}
