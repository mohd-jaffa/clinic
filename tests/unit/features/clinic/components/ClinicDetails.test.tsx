import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { aSession, authStub } from "@tests/support/auth";
import { aClinicProfile } from "@tests/support/clinic";
import { Providers } from "@tests/support/providers";

const { auth, client, query } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { update: vi.fn(), uploadLogo: vi.fn(), removeLogo: vi.fn() },
  query: { current: {} as Record<string, unknown> },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/clinic/api.client", () => ({ ClinicClient: client }));
vi.mock("@/features/clinic/hooks/useClinic", () => ({ useClinic: () => query.current }));

const { ClinicDetails } = await import("@/features/clinic/components/ClinicDetails");

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  query.current = { data: aClinicProfile(), isLoading: false, mutate: vi.fn() };
  client.update.mockImplementation(async (change: object) =>
    aClinicProfile({ paperSize: "A5", feeTiming: "AT_ARRIVAL", ...change }),
  );
});

const draw = () =>
  render(
    <Providers>
      <ClinicDetails />
    </Providers>,
  );

const details = () => screen.getByRole("region", { name: "Details" });

describe("ClinicDetails (plan §9, D78)", () => {
  it("names itself and the clinic on the land, and leads back to Settings", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Clinic details" })).toBeInTheDocument();
    expect(screen.getByText("Smile Care Dental", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/settings");
  });

  it("lists the details as rows, each opening the one sheet that changes them", async () => {
    draw();
    const rows = within(details()).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Clinic nameSmile Care Dental",
      "Clinic typeDental",
      "Address12 MG Road, Kochi",
      "Phone and emailNo phone or email added",
      "GSTINNo GSTIN added",
      "Time zoneIndia (IST)",
    ]);
    expect(within(rows[5]).queryByRole("button")).not.toBeInTheDocument();

    await userEvent.click(within(details()).getByRole("button", { name: "Address" }));
    const sheet = screen.getByRole("dialog", { name: "Change clinic details" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Change clinic details" })).not.toBeInTheDocument();
  });

  it("joins the phone and the email, and shows the GSTIN", () => {
    query.current = {
      data: aClinicProfile({ phone: "0484 234 5678", email: "desk@smilecare.in", gstin: "32ABCDE1234F1Z5" }),
    };
    draw();
    expect(details()).toHaveTextContent("0484 234 5678 · desk@smilecare.in");
    expect(details()).toHaveTextContent("32ABCDE1234F1Z5");
  });

  it("saves the paper size the moment it is picked", async () => {
    draw();
    const paper = screen.getByRole("radiogroup", { name: "Paper size" });
    await userEvent.click(within(paper).getByRole("radio", { name: "A4" }));
    expect(client.update).not.toHaveBeenCalled();

    // Shown at once, while it is saved.
    let saved: (profile: unknown) => void = () => {};
    client.update.mockReturnValue(new Promise((resolve) => (saved = resolve)));
    await userEvent.click(within(paper).getByRole("radio", { name: "A5" }));
    expect(within(paper).getByRole("radio", { name: "A5" })).toHaveAttribute("aria-checked", "true");
    expect(client.update).toHaveBeenCalledWith({ paperSize: "A5" });
    saved(aClinicProfile({ paperSize: "A5" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Bills and prescriptions now print on A5"),
    );
  });

  it("saves when the consultation fee is collected the moment it is picked", async () => {
    draw();
    const fee = screen.getByRole("radiogroup", { name: "Consultation fee" });
    await userEvent.click(within(fee).getByRole("radio", { name: "After the consultation" }));
    expect(client.update).not.toHaveBeenCalled();

    await userEvent.click(within(fee).getByRole("radio", { name: "At arrival" }));
    expect(client.update).toHaveBeenCalledWith({ feeTiming: "AT_ARRIVAL" });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("The consultation fee is now collected at arrival"),
    );
  });

  it("puts a choice back, and says why, when it cannot be saved", async () => {
    client.update.mockRejectedValue(new ApiError(422, "CLINIC_PLAN_EXPIRED", "Your clinic is view-only."));
    draw();
    const paper = screen.getByRole("radiogroup", { name: "Paper size" });
    await userEvent.click(within(paper).getByRole("radio", { name: "A5" }));

    expect(await screen.findByRole("alertdialog", { name: "That wasn’t changed" })).toHaveTextContent(
      "Your clinic is view-only.",
    );
    expect(within(paper).getByRole("radio", { name: "A4" })).toHaveAttribute("aria-checked", "true");

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    const fee = screen.getByRole("radiogroup", { name: "Consultation fee" });
    await userEvent.click(within(fee).getByRole("radio", { name: "At arrival" }));
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t changed" })).toBeInTheDocument();
  });

  it("in a view-only clinic, shows everything and changes nothing, saying why (plan §7.2)", () => {
    auth.current = authStub({ subscription: { ...aSession().subscription!, state: "READ_ONLY" } });
    draw();
    expect(within(details()).queryAllByRole("button")).toEqual([]);
    expect(details()).toHaveTextContent("Your clinic is view-only until its plan is renewed.");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    const documents = screen.getByRole("region", { name: "Bills and prescriptions" });
    expect(documents).toHaveTextContent("Paper sizeA4");
    expect(documents).toHaveTextContent("Consultation feeAfter the consultation");
  });

  it("stands in rows while it loads, and offers Try again when it cannot load", async () => {
    query.current = { data: undefined, isLoading: true };
    const { unmount } = draw();
    expect(screen.getByRole("region", { name: "Loading…" })).toHaveAttribute("aria-busy", "true");
    unmount();

    const mutate = vi.fn();
    query.current = { data: undefined, isLoading: false, error: new Error("offline"), mutate };
    draw();
    expect(screen.getByRole("alert")).toHaveTextContent("The clinic's details couldn't be loaded.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalled();
  });
});
