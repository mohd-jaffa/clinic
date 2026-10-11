import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClosureNotices } from "@/features/appointments/components/ClosureNotices";

describe("ClosureNotices", () => {
  it("says each closure of the day on a line of its own, and nothing when there is none", () => {
    const { container, rerender } = render(
      <ClosureNotices notices={["Clinic closed: Diwali", "Maya Rao away: Conference"]} />,
    );
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Clinic closed: Diwali",
      "Maya Rao away: Conference",
    ]);
    rerender(<ClosureNotices notices={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
