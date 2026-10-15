import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { TemplateEditor } from "@/features/prescriptions/components/TemplateEditor";

export const metadata: Metadata = { title: UI_TEXT.templates.newTitle };

export default function NewTemplatePage() {
  return (
    <AppScreen>
      <TemplateEditor id={null} />
    </AppScreen>
  );
}
