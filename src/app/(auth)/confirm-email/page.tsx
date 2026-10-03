import type { Metadata } from "next";

import { UI_TEXT } from "@/constants/messages";
import { ConfirmEmailScreen } from "@/features/auth/components/ConfirmEmailScreen";

export const metadata: Metadata = { title: UI_TEXT.auth.checkEmailTitle };

export default function ConfirmEmailPage() {
  return <ConfirmEmailScreen />;
}
