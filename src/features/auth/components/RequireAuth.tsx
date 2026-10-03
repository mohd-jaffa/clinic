"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { ScreenSkeleton } from "@/components/ui/skeleton";
import { UI_TEXT } from "@/constants/messages";
import { ADMIN_ROUTE, signInPath } from "@/constants/routes";

import { useAuth } from "../AuthProvider";

/**
 * The gate every signed-in screen sits behind (plan §5.5, ported from Brio).
 * It sends a visitor without a session to sign in, remembering where they
 * were going, and sends the platform admin, who belongs to no clinic, to the
 * developer console (plan §3.2).
 *
 * While the session is being checked, the screen's land draws first and the
 * screen mounts out of sight: hidden, so nothing of it shows, takes focus or
 * reaches a screen reader, but it asks for its data at the same moment as the
 * session rather than a round trip after it. Once the session is known the
 * same element simply shows, so the screen is not mounted twice.
 *
 * It is a convenience, not the control: the API and RLS refuse both cases on
 * their own, so a screen that slipped past this would have nothing to show.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const developer = profile?.platformRole === "DEV";
  const blocked = status === "anonymous" || developer;

  useEffect(() => {
    if (status === "anonymous") router.replace(signInPath(pathname));
    else if (developer) router.replace(ADMIN_ROUTE);
  }, [status, developer, pathname, router]);

  if (blocked) return <ScreenSkeleton label={UI_TEXT.auth.checkingSession} />;

  const checking = status === "loading";
  return (
    <>
      {checking && <ScreenSkeleton label={UI_TEXT.auth.checkingSession} />}
      {/* `contents` once shown, so the wrapper adds nothing to the layout; the
          element stays the same either way, so the screen is kept. */}
      <div hidden={checking} className={checking ? undefined : "contents"}>
        {children}
      </div>
    </>
  );
}
