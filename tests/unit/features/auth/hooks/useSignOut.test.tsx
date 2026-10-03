import { act, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth } = vi.hoisted(() => ({ auth: { current: {} as ReturnType<typeof authStub> } }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));

const { useSignOut } = await import("@/features/auth/hooks/useSignOut");

beforeEach(() => {
  auth.current = authStub();
});

const card = () => screen.getByRole("alertdialog", { name: "Sign out?" });

describe("useSignOut", () => {
  it("asks first, and signs out once it is agreed, closing what it sat in", async () => {
    const onSignedOut = vi.fn();
    const { result } = renderHook(() => useSignOut(onSignedOut), { wrapper: Providers });

    let done!: Promise<void>;
    act(() => {
      done = result.current.signOut();
    });
    expect(card()).toHaveTextContent("You’ll need your email or mobile number and your password to sign in again.");
    expect(auth.current.signOut).not.toHaveBeenCalled();

    await userEvent.click(within(card()).getByRole("button", { name: "Sign out" }));
    await act(() => done);
    expect(result.current.signingOut).toBe(true);
    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(auth.current.signOut).toHaveBeenCalledOnce();
  });

  it("stays signed in when that is the answer", async () => {
    const onSignedOut = vi.fn();
    const { result } = renderHook(() => useSignOut(onSignedOut), { wrapper: Providers });

    let done!: Promise<void>;
    act(() => {
      done = result.current.signOut();
    });
    await userEvent.click(within(card()).getByRole("button", { name: "Stay signed in" }));
    await act(() => done);
    expect(result.current.signingOut).toBe(false);
    expect(onSignedOut).not.toHaveBeenCalled();
    expect(auth.current.signOut).not.toHaveBeenCalled();
  });

  it("does nothing more while it is on its way out", async () => {
    auth.current = authStub({ signOut: vi.fn(() => new Promise<void>(() => {})) });
    const { result } = renderHook(() => useSignOut(), { wrapper: Providers });

    act(() => void result.current.signOut());
    await userEvent.click(within(card()).getByRole("button", { name: "Sign out" }));
    expect(result.current.signingOut).toBe(true);

    await act(() => result.current.signOut());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(auth.current.signOut).toHaveBeenCalledOnce();
  });
});
