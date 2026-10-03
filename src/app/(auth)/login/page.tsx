import type { Metadata } from "next";

import { UI_TEXT } from "@/constants/messages";
import { SignInScreen } from "@/features/auth/components/SignInScreen";

export const metadata: Metadata = { title: UI_TEXT.auth.signIn };

export default function SignInPage() {
  return <SignInScreen />;
}
