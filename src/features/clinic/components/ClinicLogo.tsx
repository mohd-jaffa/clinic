import { ImageOff } from "lucide-react";
import Image from "next/image";

import { cn } from "@/components/ui/cn";
import { UI_TEXT } from "@/constants/messages";

const SIZES = { sm: 44, lg: 96 } as const;

/**
 * The clinic's logo, as the API serves it (plan §9): fitted inside a soft
 * square of paper white — as it will print, whatever the theme — never
 * cropped. Read straight from the API, never through Next's image optimiser,
 * which would keep a copy. With none, `lg` holds a quiet mark saying so on
 * the surface; `sm` draws nothing.
 */
export function ClinicLogo({ url, clinic, size }: { url: string | null; clinic: string; size: keyof typeof SIZES }) {
  if (!url && size === "sm") return null;
  const px = SIZES[size];
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden ring-1 ring-line",
        url ? "bg-paper" : "bg-surface",
        size === "lg" ? "size-24 rounded-row p-2" : "size-11 rounded-row p-1.5",
      )}
    >
      {url ? (
        <Image
          src={url}
          alt={UI_TEXT.clinic.logoAlt(clinic)}
          width={px}
          height={px}
          unoptimized
          className="size-full object-contain"
        />
      ) : (
        <ImageOff size={28} strokeWidth={2} aria-hidden="true" className="text-muted" />
      )}
    </span>
  );
}
