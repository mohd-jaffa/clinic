import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aConsoleError } from "@tests/support/console";
import { Providers } from "@tests/support/providers";

const { errors } = vi.hoisted(() => ({ errors: { current: {} as Record<string, unknown> } }));
vi.mock("@/features/admin/hooks/useConsoleErrors", () => ({ useConsoleErrors: () => errors.current }));

const { ConsoleErrors } = await import("@/features/admin/components/ConsoleErrors");

const draw = () => render(<ConsoleErrors />, { wrapper: Providers });

beforeEach(() => {
  errors.current = {
    data: [
      aConsoleError(),
      aConsoleError({
        id: "e-2",
        source: "SERVER",
        message: "Could not send the confirmation email",
        code: null,
        kind: null,
        httpStatus: null,
        method: null,
        path: null,
        reference: null,
        account: null,
        clinicName: null,
        detail: null,
        stack: null,
        context: null,
      }),
    ],
    isLoading: false,
  };
});

describe("ConsoleErrors (plan §20.6; D372)", () => {
  it("lists the server's own failures: what failed, where and when", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Error log" })).toBeInTheDocument();
    const [request, server] = within(screen.getByRole("list", { name: "Error log" })).getAllByRole("listitem");
    expect(request).toHaveTextContent("Request failed");
    expect(request).toHaveTextContent("INTERNAL_ERROR · 500 · POST /api/bills");
    expect(server).toHaveTextContent("Could not send the confirmation email");
    expect(server).toHaveTextContent("SERVER");
  });

  it("opens the whole entry, and closes it", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Request failed" }));
    const sheet = screen.getByRole("dialog", { name: "Failure" });
    for (const text of [
      "CodeINTERNAL_ERROR",
      "KindINTERNAL",
      "Status500",
      "RequestPOST /api/bills",
      "Referencereq_4821",
      "AccountAsha Menon · asha@smilecare.in",
      "ClinicSmile Care",
      'relation "bills" does not exist',
      '"route": "/api/bills"',
      "at createBill",
    ]) {
      expect(sheet).toHaveTextContent(text);
    }
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Failure" })).not.toBeInTheDocument();
  });

  it("opens an entry with little in it on only what it holds", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Could not send the confirmation email" }));
    const sheet = screen.getByRole("dialog", { name: "Failure" });
    expect(sheet).toHaveTextContent("SourceSERVER");
    expect(sheet).not.toHaveTextContent("Code");
    expect(sheet).not.toHaveTextContent("Stack");
  });

  it("says when nothing has failed", () => {
    errors.current = { data: [], isLoading: false };
    draw();
    expect(screen.getByText("Nothing has failed.")).toBeInTheDocument();
  });
});
