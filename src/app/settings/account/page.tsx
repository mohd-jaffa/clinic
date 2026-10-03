import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { MyAccount } from "@/features/auth/components/MyAccount";

export const metadata: Metadata = { title: UI_TEXT.nav.myAccount };

export default function MyAccountPage() {
  return (
    <AppScreen>
      <MyAccount />
    </AppScreen>
  );
}
