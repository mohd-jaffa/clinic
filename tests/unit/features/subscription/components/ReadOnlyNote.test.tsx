import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { readOnly } = vi.hoisted(() => ({ readOnly: { current: false } }));
vi.mock("@/features/subscription/hooks/useReadOnly", () => ({
  useReadOnly: () => ({ readOnly: readOnly.current, reason: "Your clinic is view-only until its plan is renewed." }),
}));

const { ReadOnlyNote } = await import("@/features/subscription/components/ReadOnlyNote");

describe("ReadOnlyNote", () => {
  it("says why the controls beside it are off, in a view-only clinic", () => {
    readOnly.current = true;
    render(<ReadOnlyNote />);
    expect(screen.getByText("Your clinic is view-only until its plan is renewed.")).toBeInTheDocument();
  });

  it("says nothing while the clinic may write", () => {
    readOnly.current = false;
    const { container } = render(<ReadOnlyNote />);
    expect(container).toBeEmptyDOMElement();
  });
});
