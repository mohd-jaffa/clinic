import type { Metadata } from "next";

import { UI_TEXT } from "@/constants/messages";
import { ForgotPasswordScreen } from "@/features/auth/components/ForgotPasswordScreen";

export const metadata: Metadata = { title: UI_TEXT.auth.forgotTitle };

export default function ForgotPasswordPage() {
  return <ForgotPasswordScreen />;
}
