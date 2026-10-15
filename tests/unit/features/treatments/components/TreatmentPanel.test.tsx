import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { aTreatment } from "@tests/support/treatments";

vi.mock("@/features/treatments/components/TreatmentSheet", () => ({
  TreatmentSheet: ({
    open,
    onClose,
    onEdit,
    onCancel,
  }: {
    open: boolean;
    onClose: () => void;
    onEdit: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Its sheet">
        <button type="button" onClick={onEdit}>
          Edit
        </button>
        <button type="button" onClick={onCancel}>
          Cancel treatment
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));
vi.mock("@/features/treatments/components/TreatmentForms", () => ({
  EditTreatmentSheet: ({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) =>
    open ? (
      <div role="dialog" aria-label="Edit treatment">
        <button type="button" onClick={onClose}>
          Back
        </button>
        <button type="button" onClick={onDone}>
          Saved
        </button>
      </div>
    ) : null,
}));
vi.mock("@/features/treatments/components/CancelTreatmentSheet", () => ({
  CancelTreatmentSheet: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" aria-label="Why">
        <button type="button" onClick={onClose}>
          Back
        </button>
      </div>
    ) : null,
}));

const { TreatmentPanel } = await import("@/features/treatments/components/TreatmentPanel");

describe("TreatmentPanel (D261)", () => {
  it("opens its sheet, Edit and Cancel in its place, going back to it — and closes when done", async () => {
    const onClose = vi.fn();
    render(<TreatmentPanel treatment={aTreatment()} visit={null} writes open onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("dialog", { name: "Edit treatment" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Its sheet" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel treatment" }));
    expect(screen.getByRole("dialog", { name: "Why" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Saved" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("brings no edit or cancel sheet for whoever may only read, and nothing for no treatment", () => {
    const { container } = render(
      <TreatmentPanel treatment={null} visit={null} writes={false} open onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
    render(<TreatmentPanel treatment={aTreatment()} visit={null} writes={false} open onClose={vi.fn()} />);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});
