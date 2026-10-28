import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { anAuditEntry } from "@tests/support/console";
import { Providers } from "@tests/support/providers";

const { audit } = vi.hoisted(() => ({ audit: { current: {} as Record<string, unknown> } }));
vi.mock("@/features/admin/hooks/useConsoleAudit", () => ({ useConsoleAudit: () => audit.current }));

const { ConsoleAudit } = await import("@/features/admin/components/ConsoleAudit");

const draw = () => render(<ConsoleAudit />, { wrapper: Providers });

beforeEach(() => {
  audit.current = {
    data: [anAuditEntry(), anAuditEntry({ id: "a-2", entityType: "clinics", action: "DELETE", actorName: null })],
    isLoading: false,
  };
});

describe("ConsoleAudit (plan §20.7)", () => {
  it("lists the console's own actions, what each did, who did it and when", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Audit" })).toBeInTheDocument();
    const [settings, other] = within(screen.getByRole("list", { name: "Audit" })).getAllByRole("listitem");
    expect(settings).toHaveTextContent("Settings changed");
    expect(settings).toHaveTextContent("Trial days 30 → 45");
    expect(settings).toHaveTextContent(/Jaffa · 28 Oct 2026/);
    expect(other).toHaveTextContent("clinics · DELETE");
    expect(other).toHaveTextContent("Someone no longer here");
  });

  it("says when nothing has been recorded", () => {
    audit.current = { data: [], isLoading: false };
    draw();
    expect(screen.getByText("Nothing recorded yet.")).toBeInTheDocument();
  });
});
