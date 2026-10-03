import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RowList } from "@/components/ui/row";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth } = vi.hoisted(() => ({ auth: { current: {} as ReturnType<typeof authStub> } }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));

const { SignOutRow } = await import("@/features/auth/components/SignOutRow");

beforeEach(() => {
  auth.current = authStub({ signOut: vi.fn(() => new Promise<void>(() => {})) });
});

describe("SignOutRow", () => {
  it("asks first, then says it is on its way out, closing what it sat in", async () => {
    const onSignedOut = vi.fn();
    render(
      <Providers>
        <RowList>
          <SignOutRow onSignedOut={onSignedOut} />
        </RowList>
      </Providers>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const card = screen.getByRole("alertdialog", { name: "Sign out?" });
    await userEvent.click(within(card).getByRole("button", { name: "Sign out" }));

    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(auth.current.signOut).toHaveBeenCalledOnce();
    expect(screen.getByRole("listitem")).toHaveTextContent("Signing out…");
  });
});
