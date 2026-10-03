import type { Metadata } from "next";

import { UI_TEXT } from "@/constants/messages";
import { RegisterScreen } from "@/features/auth/components/RegisterScreen";

export const metadata: Metadata = { title: UI_TEXT.auth.registerTitle };

export default function RegisterPage() {
  return <RegisterScreen />;
}
