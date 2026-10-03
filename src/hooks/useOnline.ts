"use client";

import { useSyncExternalStore } from "react";

import { isOnline, onConnectionChange } from "@/lib/network/connection";

/**
 * Whether the device has a connection, for a screen to show it (plan §21,
 * D55). The server draws every page as online: it cannot know, and React
 * moves to the truth right after hydration.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(onConnectionChange, isOnline, () => true);
}
