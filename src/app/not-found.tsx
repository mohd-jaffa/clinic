import type { Metadata } from "next";

import { NotFoundScreen } from "@/components/nav/NotFoundScreen";
import { UI_TEXT } from "@/constants/messages";

export const metadata: Metadata = { title: UI_TEXT.system.notFoundTitle };

/** Any address the app does not have, and any `notFound()` (plan §31.2). */
export default function NotFound() {
  return <NotFoundScreen />;
}
