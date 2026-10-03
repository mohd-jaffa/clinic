"use client";

import { useEffect, useSyncExternalStore } from "react";

import { readNavigation, settleNavigation, startNavigation, subscribeNavigation } from "@/lib/navigation/pending";

/** A click that leaves for another of the app's screens by a link, in this tab. */
function leavesByLink(event: MouseEvent): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(link instanceof HTMLAnchorElement) || link.hasAttribute("download")) return false;
  if (link.target !== "" && link.target !== "_self") return false;
  const url = new URL(link.href, window.location.href);
  return (
    url.origin === window.location.origin &&
    !url.pathname.startsWith("/api/") &&
    url.pathname !== window.location.pathname
  );
}

/**
 * Whether the screen is on its way out (ported from Brio): a link to another
 * screen was followed (or code said so, `startNavigation`) and the next has
 * not arrived yet. The shell calls it once; the navigation is over the moment
 * the path changes under it.
 */
export function useNavigationPending(pathname: string): boolean {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (leavesByLink(event)) startNavigation();
    };
    // Capture, so it is seen before a link's own handler takes it over.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    settleNavigation();
  }, [pathname]);

  return useSyncExternalStore(subscribeNavigation, readNavigation, () => "idle" as const) === "slow";
}
