import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_LOGO_BYTES } from "@/constants/uploads";
import { ApiError } from "@/lib/api/client";
import { aSession, authStub } from "@tests/support/auth";
import { aClinicProfile } from "@tests/support/clinic";
import { Providers } from "@tests/support/providers";

const { auth, client } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { uploadLogo: vi.fn(), removeLogo: vi.fn() },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/clinic/api.client", () => ({ ClinicClient: client }));

const { LogoSection } = await import("@/features/clinic/components/LogoSection");

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  client.uploadLogo.mockResolvedValue(aClinicProfile({ logoUrl: "/api/clinic/logo?v=2" }));
  client.removeLogo.mockResolvedValue(aClinicProfile({ logoUrl: null }));
});

function draw(logoUrl: string | null = "/api/clinic/logo?v=1") {
  const view = render(
    <Providers>
      <LogoSection profile={aClinicProfile({ logoUrl })} />
    </Providers>,
  );
  const picker = view.container.querySelector<HTMLInputElement>("input[type=file]")!;
  return { picker, choose: (file: File) => fireEvent.change(picker, { target: { files: [file] } }) };
}

const png = (size = 10) => new File([new Uint8Array(size)], "logo.png", { type: "image/png" });

describe("LogoSection (plan §9, AGENTS.md §20)", () => {
  it("shows the logo, with Change and Remove, and what a logo may be", () => {
    const { picker } = draw();
    const section = screen.getByRole("region", { name: "Logo" });
    expect(within(section).getByRole("img", { name: "Smile Care Dental logo" })).toBeInTheDocument();
    expect(section).toHaveTextContent("PNG, JPG or WebP, up to 500 KB.");
    expect(picker).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");

    const click = vi.spyOn(picker, "click");
    fireEvent.click(within(section).getByRole("button", { name: "Change logo" }));
    expect(click).toHaveBeenCalled();
    expect(within(section).getByRole("button", { name: "Remove logo" })).toBeInTheDocument();
  });

  it("offers Add logo, and nothing to remove, while there is none", () => {
    draw(null);
    expect(screen.getByRole("button", { name: "Add logo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove logo" })).not.toBeInTheDocument();
  });

  it("stores a chosen logo at once, then says so", async () => {
    const { choose, picker } = draw();
    const logo = png();
    choose(logo);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Logo saved"));
    expect(client.uploadLogo).toHaveBeenCalledWith(logo);
    expect(auth.current.reload).toHaveBeenCalled();
    // The picker is emptied, so the same file can be chosen again.
    expect(picker.value).toBe("");
  });

  it("stops a file of the wrong type or too large before sending it", async () => {
    const { choose } = draw();
    choose(new File(["gif"], "logo.gif", { type: "image/gif" }));
    expect(await screen.findByRole("alertdialog", { name: "The logo wasn’t changed" })).toHaveTextContent(
      "A logo must be a PNG, JPG or WebP image.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    choose(png(MAX_LOGO_BYTES + 1));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("That logo is larger than 500 KB.");
    expect(client.uploadLogo).not.toHaveBeenCalled();
  });

  it("ignores a picker closed with nothing chosen", () => {
    const { picker } = draw();
    fireEvent.change(picker, { target: { files: [] } });
    expect(client.uploadLogo).not.toHaveBeenCalled();
  });

  it("says why when the logo cannot be stored", async () => {
    client.uploadLogo.mockRejectedValue(new ApiError(502, "LOGO_UPLOAD_FAILED", "The logo couldn't be stored."));
    draw().choose(png());
    expect(await screen.findByRole("alertdialog", { name: "The logo wasn’t changed" })).toHaveTextContent(
      "The logo couldn't be stored.",
    );
  });

  it("removes the logo only once asked, and says so (D79)", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Remove logo" }));
    const ask = screen.getByRole("alertdialog", { name: "Remove the logo?" });
    expect(ask).toHaveTextContent("Bills and prescriptions will show the clinic’s name only.");
    await userEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
    expect(client.removeLogo).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Remove logo" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog", { name: "Remove the logo?" })).getByRole("button", {
        name: "Remove logo",
      }),
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Logo removed"));
    expect(client.removeLogo).toHaveBeenCalled();
  });

  it("in a view-only clinic, shows the logo and why it cannot change", () => {
    auth.current = authStub({ subscription: { ...aSession().subscription!, state: "READ_ONLY" } });
    draw(null);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("No logo yet")).toBeInTheDocument();
    expect(screen.getByText("Your clinic is view-only until its plan is renewed.")).toBeInTheDocument();
  });
});
