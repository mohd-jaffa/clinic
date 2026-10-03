import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";
import { aMemberDetail } from "@tests/support/team";

const { client } = vi.hoisted(() => ({ client: { update: vi.fn() } }));
vi.mock("@/features/team/api.client", () => ({ TeamClient: client }));

const { JobTitleSheet } = await import("@/features/team/components/JobTitleSheet");

const meera = aMemberDetail({ id: "m-3", name: "Meera Pillai", role: "STAFF", jobTitle: "Front desk", doctor: null });
const onClose = vi.fn();

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <JobTitleSheet
      open={open}
      onClose={() => {
        onClose();
        setOpen(false);
      }}
      member={meera}
    />
  );
}

const draw = () =>
  render(
    <Providers>
      <Harness />
    </Providers>,
  );
const save = () => userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));

beforeEach(() => {
  vi.clearAllMocks();
  // As the server answers: an emptied title is none.
  client.update.mockImplementation(async ({ jobTitle }: { jobTitle: string }) => ({
    ...meera,
    jobTitle: jobTitle || null,
  }));
});

describe("JobTitleSheet (plan §8.4)", () => {
  it("changes a job title, and clears one", async () => {
    draw();
    const title = within(screen.getByRole("dialog", { name: "Change job title" })).getByRole("textbox", {
      name: /^Job title/,
    });
    expect(title).toHaveValue("Front desk");
    await userEvent.clear(title);
    await save();
    await waitFor(() => expect(client.update).toHaveBeenCalledWith({ id: "m-3", jobTitle: "" }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("says why it could not save", async () => {
    client.update.mockRejectedValue(new ApiError(422, "TEAM_NOT_YOURSELF", "You can't change your own access."));
    draw();
    await save();
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t saved" })).toHaveTextContent("your own access");
  });
});
