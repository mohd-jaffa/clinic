import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";
import { aTeamMember } from "@tests/support/team";

const { client } = vi.hoisted(() => ({ client: { resend: vi.fn(), revoke: vi.fn() } }));
vi.mock("@/features/team/api.client", () => ({ TeamClient: client }));

const { useInviteActions } = await import("@/features/team/hooks/useInviteActions");

const meera = aTeamMember({ id: "m-9", status: "INVITED" });
let hook: { current: ReturnType<typeof useInviteActions> };

beforeEach(() => {
  client.resend.mockReset().mockResolvedValue(meera);
  client.revoke.mockReset().mockResolvedValue(meera);
  hook = renderHook(() => useInviteActions(), { wrapper: Providers }).result;
});

describe("useInviteActions (plan §8.4)", () => {
  it("resends at once, marking which invite meanwhile, and says where it went", async () => {
    let finish: (value: typeof meera) => void = () => {};
    client.resend.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    let done: Promise<void>;
    act(() => {
      done = hook.current.resend(meera);
    });
    expect(hook.current.busy).toBe("m-9");
    await act(async () => {
      finish(meera);
      await done;
    });
    expect(client.resend).toHaveBeenCalledWith("m-9");
    expect(hook.current.busy).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("A new invite went to meera@example.com");
  });

  it("says why a resend failed, in the API's words", async () => {
    client.resend.mockRejectedValue(new ApiError(502, "MAIL_NOT_CONFIGURED", "Email isn't set up yet."));
    await act(() => hook.current.resend(meera));
    expect(screen.getByRole("alertdialog", { name: "The invite wasn’t sent again" })).toHaveTextContent(
      "Email isn't set up yet.",
    );
  });

  it("revokes only once asked, on a danger card", async () => {
    let done: Promise<void>;
    act(() => {
      done = hook.current.revoke(meera);
    });
    const ask = await screen.findByRole("alertdialog", { name: "Revoke Meera Pillai’s invite?" });
    expect(ask).toHaveTextContent("Their link stops working.");
    await userEvent.click(within(ask).getByRole("button", { name: "Revoke" }));
    await act(() => done);
    expect(client.revoke).toHaveBeenCalledWith("m-9");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Meera Pillai’s invite revoked"));
  });

  it("does nothing when the question is put aside, and says why a revoke failed", async () => {
    let done: Promise<void>;
    act(() => {
      done = hook.current.revoke(meera);
    });
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    await act(() => done);
    expect(client.revoke).not.toHaveBeenCalled();

    client.revoke.mockRejectedValue(
      new ApiError(409, "INVITE_CHANGED", "That invite was accepted or removed meanwhile."),
    );
    act(() => {
      void hook.current.revoke(meera);
    });
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Revoke" }));
    expect(await screen.findByRole("alertdialog", { name: "The invite wasn’t revoked" })).toHaveTextContent(
      "accepted or removed",
    );
  });
});
