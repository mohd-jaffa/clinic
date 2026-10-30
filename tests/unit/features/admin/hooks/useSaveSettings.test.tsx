import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import { ApiError } from "@/lib/api/client";
import type { PlatformSettingsInput, PlatformSettingsPayload } from "@/lib/validation";
import { Providers } from "@tests/support/providers";

const { client, revalidated } = vi.hoisted(() => ({ client: { saveSettings: vi.fn() }, revalidated: [] as unknown[] }));
vi.mock("@/features/admin/api.client", () => ({ ConsoleClient: client }));
vi.mock("@/lib/query/useApiMutation", async (actual) => {
  const real = await actual<typeof import("@/lib/query/useApiMutation")>();
  return {
    useApiMutation: (action: never, options: { revalidate?: unknown[] }) => {
      revalidated.push(options.revalidate);
      return real.useApiMutation(action, options as never);
    },
  };
});

const { useSaveSettings } = await import("@/features/admin/hooks/useSaveSettings");

const onDone = vi.fn();
const typed: PlatformSettingsInput = { trialDays: "45", monthlyPricePaise: "300", yearlyPricePaise: "3000" };
const read: PlatformSettingsPayload = { trialDays: 45, monthlyPricePaise: 30_000, yearlyPricePaise: 300_000 };

function Save({ payload = read }: { payload?: PlatformSettingsPayload }) {
  const { save, submitting } = useSaveSettings(PLATFORM_SETTING_DEFAULTS, onDone);
  return (
    <button type="button" aria-busy={submitting} onClick={() => void save(typed, payload)}>
      Go
    </button>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  revalidated.length = 0;
});

describe("useSaveSettings (plan §6, §20.4; D378, D381)", () => {
  it("asks first with each change and when it takes effect, sends only what changed, and says it", async () => {
    const saved = { ...PLATFORM_SETTING_DEFAULTS, trialDays: 45 };
    client.saveSettings.mockResolvedValue(saved);
    render(<Save />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    const card = await screen.findByRole("alertdialog", { name: "Save these settings?" });
    expect(within(card).getByText("Trial days 30 → 45. Applies to clinics that sign up from now.")).toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.saveSettings).toHaveBeenCalledWith({ trialDays: "45" }));
    expect((await screen.findAllByText("Settings saved"))[0]).toBeInTheDocument();
    expect(screen.getAllByText("Trial days 30 → 45.")[0]).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledWith(saved);
    expect(revalidated[0]).toEqual(["/api/admin/settings", "/api/admin/audit"]);
  });

  it("asks nothing and sends nothing when nothing changed, and closes", async () => {
    render(<Save payload={{ trialDays: 30 }} />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onDone).toHaveBeenCalledWith();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(client.saveSettings).not.toHaveBeenCalled();
  });

  it("sends nothing when cancelled", async () => {
    render(<Save />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(client.saveSettings).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("says why they weren't saved, and keeps the sheet open", async () => {
    client.saveSettings.mockRejectedValue(new ApiError(400, "VALIDATION_ERROR", "That value is not valid.", "req_9"));
    render(<Save />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Save" }));
    expect((await screen.findAllByText("The settings weren’t saved"))[0]).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
