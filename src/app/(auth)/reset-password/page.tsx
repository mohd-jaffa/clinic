import type { Metadata } from "next";

import { UI_TEXT } from "@/constants/messages";
import { ResetPasswordScreen } from "@/features/auth/components/ResetPasswordScreen";

export const metadata: Metadata = { title: UI_TEXT.auth.resetTitle };

export default function ResetPasswordPage() {
  return <ResetPasswordScreen />;
}
