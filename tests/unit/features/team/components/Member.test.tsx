import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { aSession, authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";
import { aMemberDetail } from "@tests/support/team";

const { auth, client, query } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { update: vi.fn(), setActive: vi.fn() },
  query: { current: {} as Record<string, unknown> },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/team/api.client", () => ({ TeamClient: client }));
vi.mock("@/features/team/hooks/useMember", () => ({ useMember: () => query.current }));

const { Member } = await import("@/features/team/components/Member");

const rahul = aMemberDetail();
const meera = aMemberDetail({
  id: "m-3",
  name: "Meera Pillai",
  role: "STAFF",
  jobTitle: "Front desk",
  specialization: null,
  isDoctor: false,
  phone: null,
  doctor: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  query.current = { data: rahul, isLoading: false };
  client.update.mockImplementation(async ({ id, ...changes }: { id: string }) => ({ ...rahul, id, ...changes }));
  client.setActive.mockImplementation(async ({ active }: { active: boolean }) => ({
    ...rahul,
    status: active ? "ACTIVE" : "INACTIVE",
  }));
});

const draw = () =>
  render(
    <Providers>
      <Member id="m-2" />
    </Providers>,
  );

describe("Member (plan §8.6, D94)", () => {
  it("shows who they are, a doctor's details, and leads back to the team", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Rahul Nair" })).toBeInTheDocument();
    expect(screen.getByText("Doctor · Orthodontist")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/team");
    expect(screen.getByText("+91 98765 01234")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Doctor details" }).closest("li")).toHaveTextContent(
      "Orthodontist · BDS, MDS · Reg. KL-1 · Fee ₹700",
    );
  });

  it("opens the doctor's details, and saves through the member", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Doctor details" }));
    const sheet = screen.getByRole("dialog", { name: "Change doctor details" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(client.update).toHaveBeenCalledWith({
        id: "m-2",
        doctor: { specialization: "Orthodontist", qualifications: "BDS, MDS", registrationNumber: "KL-1", fee: "700" },
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("saves what they can do once it has changed", async () => {
    draw();
    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: "Add patients" }));
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(client.update).toHaveBeenCalledWith({ id: "m-2", permissions: ["patients.view", "patients.create"] });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Rahul Nair’s access saved"));
  });

  it("asks for a doctor's details while there are none, and deactivates no one when the question is put aside", async () => {
    query.current = {
      data: {
        ...rahul,
        specialization: null,
        doctor: { specialization: null, qualifications: null, registrationNumber: null, feePaise: null },
      },
      isLoading: false,
    };
    draw();
    expect(screen.getByRole("button", { name: "Doctor details" }).closest("li")).toHaveTextContent(
      "Specialization, qualifications, registration number and fee",
    );
    await userEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog", { name: "Deactivate Rahul Nair?" })).getByRole("button", {
        name: "Cancel",
      }),
    );
    expect(client.setActive).not.toHaveBeenCalled();
  });

  it("deactivates, asked first on a danger card", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    const ask = screen.getByRole("alertdialog", { name: "Deactivate Rahul Nair?" });
    await userEvent.click(within(ask).getByRole("button", { name: "Deactivate" }));
    expect(client.setActive).toHaveBeenCalledWith({ id: "m-2", active: false });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Rahul Nair deactivated"));
  });

  it("says an inactive member can't sign in, and reactivates them, asked first", async () => {
    query.current = { data: { ...meera, status: "INACTIVE" }, isLoading: false };
    draw();
    expect(screen.getByText("Inactive — they can’t sign in.")).toBeInTheDocument();
    expect(screen.getByText("Not added yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Job title" }).closest("li")).toHaveTextContent("Front desk");
    await userEvent.click(screen.getByRole("button", { name: "Reactivate" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog", { name: "Reactivate Meera Pillai?" })).getByRole("button", {
        name: "Reactivate",
      }),
    );
    expect(client.setActive).toHaveBeenCalledWith({ id: "m-3", active: true });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Rahul Nair reactivated"));
  });

  it("opens a member of staff's job title", async () => {
    query.current = { data: { ...meera, jobTitle: null }, isLoading: false };
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Job title" }));
    expect(screen.getByRole("dialog", { name: "Change job title" })).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("says why access or a deactivation could not be saved", async () => {
    client.update.mockRejectedValue(new ApiError(422, "TEAM_PERMISSION_NOT_HELD", "You can only give what you have."));
    client.setActive.mockRejectedValue(new ApiError(422, "TEAM_MEMBER_NOT_YOURS", "Only the owner can change them."));
    draw();
    await userEvent.click(screen.getByRole("checkbox", { name: "Add patients" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const notSaved = await screen.findByRole("alertdialog", { name: "That wasn’t saved" });
    expect(notSaved).toHaveTextContent("only give what you have");
    await userEvent.click(within(notSaved).getByRole("button", { name: "Close" }));

    await userEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog", { name: "Deactivate Rahul Nair?" })).getByRole("button", {
        name: "Deactivate",
      }),
    );
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t changed" })).toHaveTextContent("Only the owner");
  });

  it("shows a manager someone beyond them, unchangeable, and says whose they are (D93)", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["team.manage", "patients.view"] });
    query.current = { data: { ...rahul, permissions: ["patients.view", "reports.view"] }, isLoading: false };
    draw();
    expect(screen.getByText("Only the owner can change Rahul Nair.")).toBeInTheDocument();
    expect(screen.getByText("See patients")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Doctor details" })).not.toBeInTheDocument();
  });

  it("changes nothing in a view-only clinic, or without a membership", () => {
    auth.current = authStub({ subscription: { ...aSession().subscription!, state: "READ_ONLY" } });
    const { unmount } = draw();
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
    expect(screen.getByText(/view-only/i)).toBeInTheDocument();
    unmount();
    auth.current = authStub({ membership: null });
    draw();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("stands rows in while it loads, and says why when it cannot", () => {
    query.current = { isLoading: true };
    const { unmount } = draw();
    expect(screen.getByRole("heading", { level: 1, name: "Team" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Loading…" })).toBeInTheDocument();
    unmount();
    query.current = { isLoading: false, error: new Error("down") };
    draw();
    expect(screen.getByText("This team member couldn't be loaded.")).toBeInTheDocument();
  });
});
