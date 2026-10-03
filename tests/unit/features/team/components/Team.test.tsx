import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession, authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";
import { aTeamMember } from "@tests/support/team";

const { auth, client, query } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { invite: vi.fn(), resend: vi.fn(), revoke: vi.fn() },
  query: { current: {} as Record<string, unknown> },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/team/api.client", () => ({ TeamClient: client }));
vi.mock("@/features/team/hooks/useTeam", () => ({ useTeam: () => query.current }));

const { Team } = await import("@/features/team/components/Team");

const team = [
  aTeamMember({ id: "m-0", userId: "user-1", name: "Asha Menon", role: "OWNER", jobTitle: null }),
  aTeamMember({ id: "m-1", name: "Rahul Nair", role: "DOCTOR", jobTitle: null, specialization: "Orthodontist" }),
  aTeamMember({ id: "m-2", name: "Meera Pillai", status: "INVITED", inviteExpiresAt: "2026-10-10T06:00:00Z" }),
  aTeamMember({
    id: "m-3",
    name: "Anil Kumar",
    status: "INVITED",
    inviteExpiresAt: "2026-09-01T06:00:00Z",
    inviteExpired: true,
  }),
  aTeamMember({ id: "m-4", name: "Leela George", status: "INACTIVE", jobTitle: "Nurse" }),
];

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  query.current = { data: team, isLoading: false };
  client.resend.mockImplementation(async (id: string) => team.find((member) => member.id === id));
});

const draw = () =>
  render(
    <Providers>
      <Team />
    </Providers>,
  );

const rows = (list: string) =>
  within(screen.getByRole("list", { name: list }))
    .getAllByRole("listitem")
    .map((row) => row.textContent);

describe("Team (plan §8.4, §8.6)", () => {
  it("shows who is on the team — the owner first, you named — the open invites and those inactive", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Team" })).toBeInTheDocument();
    expect(screen.getByText("2 people")).toBeInTheDocument();
    expect(rows("Team")).toEqual(["AMAsha Menon (you)Owner", "RNRahul NairDoctor · Orthodontist"]);
    expect(rows("Invited").map((row) => row?.replace(/Resend$/, ""))).toEqual([
      "MPMeera PillaiLink until 10 Oct",
      "AKAnil KumarLink has run out",
    ]);
    expect(rows("Inactive")).toEqual(["LGLeela GeorgeStaff · Nurse"]);
  });

  it("opens each member's page, and the owner's own (D94, D96)", () => {
    draw();
    expect(screen.getByRole("link", { name: "Rahul Nair" })).toHaveAttribute("href", "/team/m-1");
    expect(screen.getByRole("link", { name: "Leela George" })).toHaveAttribute("href", "/team/m-4");
    expect(screen.getByRole("link", { name: "Asha Menon (you)" })).toHaveAttribute("href", "/team/m-0");
  });

  it("opens neither the owner's page nor their own for a manager", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["team.manage", "patients.view"] });
    query.current = {
      data: [team[0], { ...team[1], userId: "user-1", name: "Rahul Nair" }, team[4]],
      isLoading: false,
    };
    draw();
    expect(screen.queryByRole("link", { name: "Asha Menon" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Rahul Nair/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leela George" })).toBeInTheDocument();
  });

  it("opens the invite sheet", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(screen.getByRole("dialog", { name: "Invite a team member" })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("resends an invite, and revokes one asked first", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Resend the invite to Meera Pillai" }));
    expect(client.resend).toHaveBeenCalledWith("m-2");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("A new invite went to meera@example.com"));

    await userEvent.click(screen.getByRole("button", { name: "Revoke Anil Kumar’s invite" }));
    expect(screen.getByRole("alertdialog", { name: "Revoke Anil Kumar’s invite?" })).toBeInTheDocument();
  });

  it("shows a view-only clinic's team without Invite, Resend or Revoke, and says why", () => {
    auth.current = authStub({ subscription: { ...aSession().subscription!, state: "READ_ONLY" } });
    draw();
    expect(screen.queryByRole("button", { name: "Invite" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Resend/ })).not.toBeInTheDocument();
    expect(screen.getByText(/view-only/i)).toBeInTheDocument();
  });

  it("leaves out sections with no one in them, and the sheet without a membership", () => {
    auth.current = authStub({ membership: null });
    query.current = { data: team.slice(0, 2), isLoading: false };
    draw();
    expect(screen.queryByRole("list", { name: "Invited" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Inactive" })).not.toBeInTheDocument();
  });

  it("stands rows in while it loads, and says why when it cannot", () => {
    query.current = { isLoading: true };
    const { unmount } = draw();
    expect(screen.getByRole("region", { name: "Loading…" })).toHaveAttribute("aria-busy", "true");
    unmount();
    query.current = { isLoading: false, error: new Error("down") };
    draw();
    expect(screen.getByText("The team couldn't be loaded.")).toBeInTheDocument();
  });
});
