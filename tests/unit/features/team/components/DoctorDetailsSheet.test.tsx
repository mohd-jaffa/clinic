import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DoctorDetailsSheet } from "@/features/team/components/DoctorDetailsSheet";
import type { DoctorDetails } from "@/features/team/types";
import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const save = vi.fn();
const onClose = vi.fn();

function Harness({ details }: { details: DoctorDetails | null }) {
  const [open, setOpen] = useState(true);
  return (
    <DoctorDetailsSheet
      open={open}
      onClose={() => {
        onClose();
        setOpen(false);
      }}
      details={details}
      save={save}
      revalidate={["/api/team/m-2"]}
    />
  );
}

const draw = (details: DoctorDetails | null) =>
  render(
    <Providers>
      <Harness details={details} />
    </Providers>,
  );
const field = (name: RegExp) => within(screen.getByRole("dialog")).getByRole("textbox", { name });

beforeEach(() => {
  vi.clearAllMocks();
  save.mockImplementation(async (input: { specialization: string }) => ({
    doctor: { specialization: input.specialization, qualifications: null, registrationNumber: null, feePaise: null },
  }));
});

describe("DoctorDetailsSheet (plan §8.4)", () => {
  it("shows the details as they are, the fee in rupees, and saves what is typed", async () => {
    draw({ specialization: "Orthodontist", qualifications: "BDS", registrationNumber: "KL-1", feePaise: 70_000 });
    expect(screen.getByRole("dialog", { name: "Change doctor details" })).toBeInTheDocument();
    expect(field(/^Consultation fee/)).toHaveValue("700");
    await userEvent.clear(field(/^Specialization/));
    await userEvent.type(field(/^Specialization/), "Endodontist");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        specialization: "Endodontist",
        qualifications: "BDS",
        registrationNumber: "KL-1",
        fee: "700",
      }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("starts empty for a doctor with none, and says why a save failed", async () => {
    save.mockRejectedValue(new ApiError(422, "TEAM_MEMBER_NOT_YOURS", "Only the owner can change this."));
    draw(null);
    expect(field(/^Consultation fee/)).toHaveValue("");
    await userEvent.type(field(/^Consultation fee/), "lots");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Consultation fee must be a valid amount.")).toBeInTheDocument();
    await userEvent.clear(field(/^Consultation fee/));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t saved" })).toHaveTextContent("Only the owner");
    expect(onClose).not.toHaveBeenCalled();
  });
});
