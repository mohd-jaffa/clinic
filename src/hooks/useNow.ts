"use client";

import { useEffect, useState } from "react";

/**
 * The time now, read again every `everyMs` — for what a screen counts on the
 * clock while nothing else changes it: how long a patient has waited.
 */
export function useNow(everyMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
