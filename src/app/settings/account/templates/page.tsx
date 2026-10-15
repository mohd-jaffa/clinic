import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { PrescriptionTemplates } from "@/features/prescriptions/components/PrescriptionTemplates";
import { ownTemplates } from "@/features/prescriptions/templates";

export const metadata: Metadata = { title: UI_TEXT.templates.title };

export default function PrescriptionTemplatesPage() {
  return (
    <AppScreen queries={ownTemplates}>
      <PrescriptionTemplates />
    </AppScreen>
  );
}
