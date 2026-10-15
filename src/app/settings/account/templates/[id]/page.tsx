import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { TemplateEditor } from "@/features/prescriptions/components/TemplateEditor";
import { ownTemplates } from "@/features/prescriptions/templates";

export const metadata: Metadata = { title: UI_TEXT.templates.title };

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppScreen queries={ownTemplates}>
      <TemplateEditor id={id} />
    </AppScreen>
  );
}
