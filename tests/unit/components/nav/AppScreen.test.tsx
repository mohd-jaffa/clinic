import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const { readScreen } = vi.hoisted(() => ({
  readScreen: vi.fn(async () => ({ queries: { "/api/patients/p-1": { name: "Meena" } }, pages: {} })),
}));
vi.mock("@/features/auth/session.server", () => ({ readScreen }));
vi.mock("@/components/nav/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/query/ServerData", () => ({
  ServerData: ({ queries, children }: { queries: Record<string, unknown>; children: ReactNode }) => (
    <div data-keys={Object.keys(queries).join(",")}>{children}</div>
  ),
}));

const { AppScreen } = await import("@/components/nav/AppScreen");

describe("AppScreen", () => {
  it("reads the screen's first data, for those it is for, before the page is drawn, and draws it in the shell", async () => {
    const patient = vi.fn();
    const visits = vi.fn();

    render(
      await AppScreen({
        access: "patients.view",
        queries: { "/api/patients/p-1": patient },
        pages: { "/api/patients/p-1/visits": visits },
        children: <p>The screen</p>,
      }),
    );

    expect(readScreen).toHaveBeenCalledWith({
      access: "patients.view",
      queries: { "/api/patients/p-1": patient },
      pages: { "/api/patients/p-1/visits": visits },
    });
    expect(screen.getByRole("main")).toHaveTextContent("The screen");
    expect(screen.getByText("The screen").closest("[data-keys]")).toHaveAttribute("data-keys", "/api/patients/p-1");
  });

  it("tells a member it is not for so, in its place (plan §31.2)", async () => {
    readScreen.mockResolvedValueOnce({ queries: {}, pages: {}, refused: true } as never);
    render(await AppScreen({ access: "settings.manage", children: <p>The screen</p> }));

    expect(screen.queryByText("The screen")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "This screen isn’t open to you" })).toBeInTheDocument();
  });
});
