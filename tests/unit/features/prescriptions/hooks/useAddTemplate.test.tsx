import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrescriptionTemplate } from "@/features/prescriptions/types";
import { ApiError } from "@/lib/api/client";
import type { TemplateInput } from "@/lib/validation";
import { Providers } from "@tests/support/providers";

const { client, refresh } = vi.hoisted(() => ({ client: { add: vi.fn(), change: vi.fn() }, refresh: vi.fn() }));
vi.mock("@/features/prescriptions/api.client", () => ({ TemplatesClient: client }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));

const { useAddTemplate } = await import("@/features/prescriptions/hooks/useAddTemplate");

const typed: TemplateInput = { name: " Viral fever ", items: [], advice: "Rest" };
const fever: PrescriptionTemplate = { id: "t-1", name: "Viral fever", advice: "Rest", active: true, items: [] };
const taken = new ApiError(409, "TEMPLATE_NAME_TAKEN", "You already have a template");

const onSaved = vi.fn();
const renderAdd = () => renderHook(() => useAddTemplate(onSaved), { wrapper: Providers }).result;

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockResolvedValue(undefined);
});

describe("useAddTemplate (D243)", () => {
  it("saves a new one, reads the templates again and says so", async () => {
    client.add.mockResolvedValue(fever);
    const hook = renderAdd();
    await act(() => hook.current.submit(typed));
    expect(client.add).toHaveBeenCalledWith({ template: typed });
    expect(refresh).toHaveBeenCalledWith(["/api/prescription-templates"]);
    expect(onSaved).toHaveBeenCalledWith(fever);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved as the template “Viral fever”"));
  });

  it("asks before replacing one of the same name, and replaces it only when told to", async () => {
    client.add.mockRejectedValueOnce(taken).mockResolvedValueOnce(fever);
    const hook = renderAdd();
    let saving: Promise<unknown>;
    act(() => {
      saving = hook.current.submit(typed);
    });
    const ask = await screen.findByRole("alertdialog", { name: "Replace your template “Viral fever”?" });
    expect(ask).toHaveTextContent("Its medicines and advice become these.");
    await userEvent.click(within(ask).getByRole("button", { name: "Replace" }));
    await act(async () => {
      await saving;
    });
    expect(client.add).toHaveBeenLastCalledWith({ template: typed, replace: true });
    expect(onSaved).toHaveBeenCalledWith(fever);
  });

  it("saves nothing when the question is put aside", async () => {
    client.add.mockRejectedValueOnce(taken);
    const hook = renderAdd();
    let saving: Promise<unknown>;
    act(() => {
      saving = hook.current.submit(typed);
    });
    const ask = await screen.findByRole("alertdialog");
    await userEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
    await act(async () => {
      await saving;
    });
    expect(client.add).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.queryByText(/Saved as the template/)).not.toBeInTheDocument();
  });

  it("says why any other refusal stopped it", async () => {
    client.add.mockRejectedValue(new ApiError(403, "AUTH_PERMISSION_DENIED", "Not yours"));
    const hook = renderAdd();
    await act(() => hook.current.submit(typed));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("The template wasn’t saved");
    expect(onSaved).not.toHaveBeenCalled();
  });
});
