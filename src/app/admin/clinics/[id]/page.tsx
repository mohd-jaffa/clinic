import type { Metadata } from "next";

import { ConsoleScreen } from "@/components/nav/ConsoleScreen";
import { UI_TEXT } from "@/constants/messages";
import { getConsoleClinic } from "@/features/admin/api";
import { ConsoleClinicPage } from "@/features/admin/components/ConsoleClinicPage";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.console.clinic };

export default async function ConsoleClinicRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ConsoleScreen queries={{ [apiRoutes.console.clinic(id)]: (admin) => getConsoleClinic(admin, id) }}>
      <ConsoleClinicPage clinicId={id} />
    </ConsoleScreen>
  );
}
