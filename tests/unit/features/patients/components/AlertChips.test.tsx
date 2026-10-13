import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertChips } from "@/features/patients/components/AlertChips";

describe("AlertChips (plan §10.4, §12.2)", () => {
  it("lists each alert as a chip, in the order given, an allergy in the danger tone", () => {
    render(
      <div>
        <AlertChips
          alerts={[
            { id: "a-1", kind: "ALLERGY", label: "Penicillin", note: null, active: true },
            { id: "a-2", kind: "CONDITION", label: "Diabetes", note: null, active: true },
          ]}
        />
      </div>,
    );
    const items = within(screen.getByRole("list", { name: "Alerts" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Allergy: Penicillin", "Condition: Diabetes"]);
  });
});
