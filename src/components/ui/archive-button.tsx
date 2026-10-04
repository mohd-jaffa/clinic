"use client";

import { Archive } from "lucide-react";

import { UI_TEXT } from "@/constants/messages";

import { Button } from "./button";

/**
 * **Archive**, at the foot of a record's edit sheet — a catalogue entry's
 * (D80), a patient's (D122) — under a hairline so it stands apart from the
 * details. `archive` asks first and answers whether it was archived; then the
 * sheet closes.
 */
export function ArchiveButton({
  archive,
  archiving,
  onArchived,
}: {
  archive: () => Promise<boolean>;
  archiving: boolean;
  onArchived: () => void;
}) {
  return (
    <div className="border-t border-line pt-5">
      <Button
        label={UI_TEXT.actions.archive}
        icon={Archive}
        variant="secondary"
        size="sm"
        loading={archiving}
        onClick={async () => {
          if (await archive()) onArchived();
        }}
      />
    </div>
  );
}
