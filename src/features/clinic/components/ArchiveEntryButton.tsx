"use client";

import { Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UI_TEXT } from "@/constants/messages";

/**
 * **Archive**, at the foot of an entry's sheet (D80), under a hairline so it
 * stands apart from the details. `archive` asks first and answers whether it
 * was archived; then the sheet closes.
 */
export function ArchiveEntryButton({
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
        label={UI_TEXT.catalogues.archive}
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
