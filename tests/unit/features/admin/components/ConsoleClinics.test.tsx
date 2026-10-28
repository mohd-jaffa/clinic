import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aConsoleClinic } from "@tests/support/console";
import { Providers } from "@tests/support/providers";

const { clinics, asked, address } = vi.hoisted(() => ({
  clinics: { current: {} as Record<string, unknown> },
  asked: [] as [string, string | null][],
  address: { filter: null as string | null },
}));
vi.mock("@/features/admin/hooks/useConsoleClinics", () => ({
  useConsoleClinics: (search: string, filter: string | null) => {
    asked.push([search, filter]);
    return clinics.current;
  },
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(address.filter ? { filter: address.filter } : {}),
}));

const { ConsoleClinics } = await import("@/features/admin/components/ConsoleClinics");

const draw = () => render(<ConsoleClinics />, { wrapper: Providers });

beforeEach(() => {
  asked.length = 0;
  address.filter = null;
  clinics.current = {
    data: [
      aConsoleClinic(),
      aConsoleClinic({ id: "c-2", name: "City Clinic", standing: "READ_ONLY", noTrial: true, members: 1 }),
    ],
    isLoading: false,
  };
});

describe("ConsoleClinics (plan §20.2; D368, D371)", () => {
  it("lists every clinic: its kind, city and owner, its plan and last day, its members, where it stands", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Clinics" })).toBeInTheDocument();
    const [smile, city] = within(screen.getByRole("list", { name: "Clinics" })).getAllByRole("listitem");
    expect(smile).toHaveTextContent("Smile Care");
    expect(smile).toHaveTextContent("Dental · Kochi · Asha Menon");
    expect(smile).toHaveTextContent("Free trial · until 31 Oct 2026 · 3 members");
    expect(smile).toHaveTextContent("Trial");
    expect(within(smile).getByRole("link", { name: "Smile Care" })).toHaveAttribute("href", "/admin/clinics/c-1");
    expect(city).toHaveTextContent("1 member");
    // No trial in place of the View only it always is.
    expect(city).toHaveTextContent("No trial");
    expect(city).not.toHaveTextContent("View only");
    expect(asked.at(-1)).toEqual(["", null]);
  });

  it("is searched, and kept to one filter — or opens on the one its address names", async () => {
    draw();
    await userEvent.type(screen.getByRole("searchbox", { name: "Clinic, city, owner, email or mobile" }), "Smile");
    await userEvent.click(screen.getByRole("radio", { name: "No trial" }));
    await vi.waitFor(() => expect(asked.at(-1)).toEqual(["Smile", "NO_TRIAL"]));
    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    expect(asked.at(-1)).toEqual(["Smile", null]);
  });

  it("opens on the filter its address names", () => {
    address.filter = "EXPIRING";
    draw();
    expect(screen.getByRole("radio", { name: "Ending soon" })).toBeChecked();
    expect(asked.at(-1)).toEqual(["", "EXPIRING"]);
  });

  it("says when no clinic has signed up, and when none matches", async () => {
    clinics.current = { data: [], isLoading: false };
    const { unmount } = draw();
    expect(screen.getByText("No clinic has signed up yet.")).toBeInTheDocument();
    unmount();
    address.filter = "GRACE";
    draw();
    expect(screen.getByText("No clinic matches.")).toBeInTheDocument();
  });
});
