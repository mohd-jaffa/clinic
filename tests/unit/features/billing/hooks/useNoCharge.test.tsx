import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client, revalidated } = vi.hoisted(() => ({ client: { noCharge: vi.fn() }, revalidated: [] as unknown[] }));
vi.mock("@/features/billing/api.client", () => ({ BillingClient: client }));
vi.mock("@/lib/query/useApiMutation", async (actual) => {
  const real = await actual<typeof import("@/lib/query/useApiMutation")>();
  return {
    useApiMutation: (action: never, options: { revalidate?: unknown[] }) => {
      revalidated.push(options.revalidate);
      return real.useApiMutation(action, options as never);
    },
  };
});

const { useNoCharge } = await import("@/features/billing/hooks/useNoCharge");

const onDone = vi.fn();

function Mark() {
  const { mark, submitting } = useNoCharge({ id: "v-1", patient: { id: "p-1", name: "Asha Rao" } }, onDone);
  return (
    <button type="button" aria-busy={submitting} onClick={() => void mark({ reason: "REVIEW", note: "" })}>
      Mark
    </button>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  revalidated.length = 0;
});

describe("useNoCharge (plan §15.6; D319)", () => {
  it("marks the visit free without asking, closes, says so, and reads To bill again", async () => {
    client.noCharge.mockResolvedValue({ visitId: "v-1" });
    render(<Mark />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Mark" }));
    await waitFor(() =>
      expect(client.noCharge).toHaveBeenCalledWith({ visitId: "v-1", input: { reason: "REVIEW", note: "" } }),
    );
    expect((await screen.findAllByText("Asha Rao’s visit marked No charge"))[0]).toBeInTheDocument();
    expect(onDone).toHaveBeenCalled();
    expect(revalidated[0]).toContain("/api/to-bill");
  });

  it("says why it was not marked", async () => {
    client.noCharge.mockRejectedValue(new ApiError(422, "VISIT_NOT_TO_BILL", "Not waiting."));
    render(<Mark />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Mark" }));
    expect(await screen.findByRole("alertdialog", { name: "The visit wasn’t marked No charge" })).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
