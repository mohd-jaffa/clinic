import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrescriptionTemplate } from "@/features/prescriptions/types";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { add: vi.fn(), change: vi.fn() } }));
vi.mock("@/features/prescriptions/api.client", () => ({ TemplatesClient: client }));

const { useTemplateChange } = await import("@/features/prescriptions/hooks/useTemplateChange");

const fever: PrescriptionTemplate = { id: "t-1", name: "Viral fever", advice: null, active: false, items: [] };

beforeEach(() => vi.clearAllMocks());

describe("useTemplateChange (D242)", () => {
  it("restores a template through its endpoint, as a catalogue's entry is", async () => {
    client.change.mockResolvedValue({ ...fever, active: true });
    const { result } = renderHook(() => useTemplateChange(), { wrapper: Providers });
    await act(() => result.current.restore(fever));
    await waitFor(() => expect(client.change).toHaveBeenCalledWith({ id: "t-1", input: { active: true } }));
  });
});
