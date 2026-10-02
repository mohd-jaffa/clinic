import { render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pageKey, ServerData } from "@/lib/query/ServerData";
import { useApiPages } from "@/lib/query/useApiPages";
import { useApiQuery } from "@/lib/query/useApiQuery";

const fetcher = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ fetcher }));

function Screen() {
  const counts = useApiQuery<{ all: number }>("/api/follow-ups/counts");
  const orders = useApiPages<string>("/api/appointments");
  return (
    <p>
      {counts.data ? `${counts.data.all} orders` : "counting"} · {orders.data?.join(", ") ?? "listing"}
    </p>
  );
}

function renderWith(node: React.ReactNode) {
  return render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{node}</SWRConfig>);
}

beforeEach(() => {
  fetcher.mockReset();
  fetcher.mockImplementation(async (key: string) =>
    key === "/api/follow-ups/counts" ? { all: 9 } : { items: ["fresh"], nextCursor: null },
  );
});

describe("ServerData", () => {
  it("draws the screen with the data the page arrived with, and does not ask for it again", async () => {
    renderWith(
      <ServerData
        queries={{ "/api/follow-ups/counts": { all: 3 } }}
        pages={{ "/api/appointments": { items: ["a", "b"], nextCursor: null } }}
      >
        <Screen />
      </ServerData>,
    );

    expect(screen.getByText("3 orders · a, b")).toBeInTheDocument();
    await new Promise((settle) => setTimeout(settle, 20));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("asks as before for anything the page did not bring", async () => {
    renderWith(
      <ServerData>
        <Screen />
      </ServerData>,
    );

    expect(screen.getByText("counting · listing")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("9 orders · fresh")).toBeInTheDocument());
  });

  it("keeps a list's pages where the list hook looks for them", () => {
    expect(pageKey("/api/appointments")).toContain("/api/appointments");
    expect(pageKey("/api/appointments")).not.toBe("/api/appointments");
  });
});
