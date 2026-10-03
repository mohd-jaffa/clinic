import type { Metadata } from "next";

import { UI_TEXT } from "@/constants/messages";
import { AcceptInviteScreen } from "@/features/team/components/AcceptInviteScreen";

export const metadata: Metadata = { title: UI_TEXT.acceptInvite.pageTitle };

export default function AcceptInvitePage() {
  return <AcceptInviteScreen />;
}
