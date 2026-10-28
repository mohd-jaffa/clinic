import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aConsoleAccount } from "@tests/support/console";
import { Providers } from "@tests/support/providers";

const { accounts, asked } = vi.hoisted(() => ({
  accounts: { current: {} as Record<string, unknown> },
  asked: [] as string[],
}));
vi.mock("@/features/admin/hooks/useConsoleAccounts", () => ({
  useConsoleAccounts: (search: string) => {
    asked.push(search);
    return accounts.current;
  },
}));
vi.mock("@/lib/dates/calendar", async (actual) => ({
  ...(await actual<typeof import("@/lib/dates/calendar")>()),
  todayKey: () => "2026-10-30",
}));

const { ConsoleAccounts } = await import("@/features/admin/components/ConsoleAccounts");

const draw = () => render(<ConsoleAccounts />, { wrapper: Providers });

beforeEach(() => {
  asked.length = 0;
  accounts.current = {
    data: [
      aConsoleAccount(),
      aConsoleAccount({
        id: "u-2",
        name: "Meera Pillai",
        membership: { clinicId: "c-1", clinicName: "Smile Care", role: "STAFF", status: "INVITED" },
        lastSignInAt: null,
      }),
      aConsoleAccount({ id: "u-3", name: "Jaffa", platformRole: "DEV", membership: null }),
      aConsoleAccount({ id: "u-4", name: "Ravi Kumar", membership: null }),
    ],
    isLoading: false,
  };
});

describe("ConsoleAccounts (plan §20.5)", () => {
  it("lists every account: where they belong and as what, their email, when they last signed in", () => {
    draw();
    const [asha, meera, jaffa, ravi] = within(screen.getByRole("list", { name: "Accounts" })).getAllByRole("listitem");
    expect(asha).toHaveTextContent("Smile Care · Owner");
    expect(asha).toHaveTextContent("asha@smilecare.in");
    expect(asha).toHaveTextContent("Signed in 2 days ago");
    expect(meera).toHaveTextContent("Smile Care · Staff");
    expect(meera).toHaveTextContent("Never signed in");
    expect(meera).toHaveTextContent("Invited");
    expect(jaffa).toHaveTextContent("Developer");
    expect(ravi).toHaveTextContent("No clinic");
  });

  it("is searched", async () => {
    draw();
    await userEvent.type(screen.getByRole("searchbox", { name: "Name, email, mobile or clinic" }), "asha");
    await vi.waitFor(() => expect(asked.at(-1)).toBe("asha"));
  });

  it("says when there are none, and when none matches", async () => {
    accounts.current = { data: [], isLoading: false };
    draw();
    expect(screen.getByText("No accounts yet.")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(await screen.findByText("No account matches.")).toBeInTheDocument();
  });
});
