"use client";

import { MessageCircle } from "lucide-react";

import { IconLink, LinkButton } from "@/components/ui/button";
import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { useAuth } from "@/features/auth/AuthProvider";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { whatsAppHref } from "@/lib/phone";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { AppointmentsClient } from "../api.client";
import { reminderText } from "../describe";
import { appointmentRoutes } from "../keys";
import type { CalendarAppointment } from "../types";

const { appointment: words } = UI_TEXT;

/**
 * **Remind on WhatsApp** (plan §22.1; D179 – D182): WhatsApp opens on the
 * patient's mobile with the reminder written — "Reminder: your appointment
 * with Dr. Maya Rao at Smile Care on Tue 14 Oct, 10:30 AM." — for a person to
 * send, and the reminder is noted as it opens (D180). In a view-only clinic
 * it still opens, and nothing is noted (D181). A capsule in the detail, a
 * round icon on a row.
 */
export function RemindButton({ appointment, look }: { appointment: CalendarAppointment; look: "capsule" | "icon" }) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const respond = useResponse();
  const noting = useApiMutation(AppointmentsClient.remind, {
    revalidate: appointmentRoutes(appointment),
    onError: (failure) => respond.failure(failure, { title: words.notReminded }),
  });
  const href = whatsAppHref(appointment.patientPhone, reminderText(appointment, membership?.clinicName ?? ""));
  const note = () => {
    if (!readOnly) void noting.submit(appointment.id);
  };
  const named = words.remindNamed(appointment.patientName);

  if (look === "icon") return <IconLink icon={MessageCircle} label={named} href={href} onClick={note} />;
  return (
    <LinkButton
      href={href}
      label={words.remind}
      accessibleName={named}
      icon={MessageCircle}
      variant="secondary"
      size="sm"
      newTab
      onClick={note}
    />
  );
}
