import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const { readConsole } = vi.hoisted(() => ({
  readConsole: vi.fn(async () => ({ queries: { "/api/admin/overview": { clinics: 2 } }, pages: {} })),
}));
vi.mock("@/features/auth/session.server", () => ({ readConsole }));
vi.mock("@/components/nav/ConsoleShell", () => ({
  ConsoleShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/query/ServerData", () => ({
  ServerData: ({ queries, children }: { queries: Record<string, unknown>; children: ReactNode }) => (
    <div data-keys={Object.keys(queries).join(",")}>{children}</div>
  ),
}));

const { ConsoleScreen } = await import("@/components/nav/ConsoleScreen");

describe("ConsoleScreen (D367)", () => {
  it("reads the console screen's first data before the page is drawn, and draws it in the console's frame", async () => {
    const overview = vi.fn();
    const accounts = vi.fn();
    render(
      await ConsoleScreen({
        queries: { "/api/admin/overview": overview },
        pages: { "/api/admin/accounts": accounts },
        children: <p>The overview</p>,
      }),
    );
    expect(readConsole).toHaveBeenCalledWith({
      queries: { "/api/admin/overview": overview },
      pages: { "/api/admin/accounts": accounts },
    });
    expect(screen.getByRole("main")).toHaveTextContent("The overview");
    expect(screen.getByText("The overview").closest("[data-keys]")).toHaveAttribute("data-keys", "/api/admin/overview");
  });
});
