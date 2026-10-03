import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";

const { auth } = vi.hoisted(() => ({ auth: { current: {} as ReturnType<typeof authStub> } }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));

const { Home } = await import("@/features/dashboard/components/Home");

describe("Home", () => {
  it("greets the person by their first name on the land, their clinic under it", () => {
    auth.current = authStub();
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "Hello, Asha" })).toBeInTheDocument();
    expect(screen.getByText("Smile Care")).toBeInTheDocument();
  });

  it("still draws its land before the session is known", () => {
    auth.current = authStub({ status: "loading", profile: null, membership: null });
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Hello,");
  });
});
