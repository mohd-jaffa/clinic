import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth } = vi.hoisted(() => ({ auth: { current: {} as ReturnType<typeof authStub> } }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/no-such-place",
}));

const { NotFoundScreen } = await import("@/components/nav/NotFoundScreen");

beforeEach(() => {
  auth.current = authStub();
});

const draw = () =>
  render(
    <Providers>
      <NotFoundScreen />
    </Providers>,
  );

describe("NotFoundScreen (plan §31.2)", () => {
  it("for someone signed in, stands inside the shell: their places around it, and the way home", () => {
    draw();

    const main = screen.getByRole("main");
    expect(main).toContainElement(screen.getByRole("heading", { level: 1, name: "This page isn’t here" }));
    expect(screen.getByText("The link may be out of date, or the address mistyped.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/home");
    expect(screen.getAllByRole("navigation", { name: "Main" }).length).toBeGreaterThan(0);
  });

  it("for anyone else, stands on its own under the app's name", () => {
    auth.current = authStub({ status: "anonymous", profile: null, membership: null });
    draw();

    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("ClinicDesk");
    expect(screen.getByRole("heading", { level: 1, name: "This page isn’t here" })).toBeInTheDocument();
  });
});
