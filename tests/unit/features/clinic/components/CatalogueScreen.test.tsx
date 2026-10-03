import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { activeCount, CatalogueScreen } from "@/features/clinic/components/CatalogueScreen";
import { Providers } from "@tests/support/providers";

type Entry = { id: string; active: boolean };

const draw = (query: Parameters<typeof CatalogueScreen<Entry>>[0]["query"]) =>
  render(
    <Providers>
      <CatalogueScreen<Entry>
        title="Price list"
        subtitle={query.data && `${activeCount(query.data)} services`}
        query={query}
        loadFailed="SERVICES_LOAD_FAILED"
      >
        {(entries) => <p>{entries.length} entries</p>}
      </CatalogueScreen>
    </Providers>,
  );

describe("CatalogueScreen", () => {
  it("names the catalogue on the land, how many are offered, and leads back to Settings", () => {
    draw({
      isLoading: false,
      data: [
        { id: "1", active: true },
        { id: "2", active: false },
      ],
    });
    expect(screen.getByRole("heading", { level: 1, name: "Price list" })).toBeInTheDocument();
    expect(screen.getByText("1 services")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/settings");
    expect(screen.getByText("2 entries")).toBeInTheDocument();
  });

  it("stands rows in while it loads", () => {
    draw({ isLoading: true });
    expect(screen.getByRole("region", { name: "Loading…" })).toHaveAttribute("aria-busy", "true");
  });

  it("says why it could not load, and tries again", async () => {
    const mutate = vi.fn();
    draw({ isLoading: false, error: new ApiError(500, "INTERNAL_ERROR", ""), mutate });
    expect(screen.getByText("The price list couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalled();
  });
});
