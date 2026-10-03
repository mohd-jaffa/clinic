"use client";

import { CoastHeader } from "@/components/ui/coast-header";
import { PageHeader } from "@/components/ui/page-header";
import { UI_TEXT } from "@/constants/messages";
import { useAuth } from "@/features/auth/AuthProvider";

/**
 * Home (plan §31.2), as far as the shell needs it: the land greets the person
 * by their first name, under it their clinic. Today's numbers, the queue in
 * miniature and the getting-started list come with Home's own phase.
 */
export function Home() {
  const { profile, membership } = useAuth();
  const firstName = profile?.fullName.trim().split(/\s+/)[0] ?? "";
  return (
    <CoastHeader>
      <div className="pb-6">
        <PageHeader title={UI_TEXT.home.greeting(firstName)} subtitle={membership?.clinicName} />
      </div>
    </CoastHeader>
  );
}
