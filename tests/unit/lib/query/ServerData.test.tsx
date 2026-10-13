import { render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pageKey, ServerData } from "@/lib/query/ServerData";
import { useApiPages } from "@/lib/query/useApiPages";
import { useApiQuery } from "@/lib/query/useApiQuery";

const fetcher = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ fetcher }));

// Next's id for the visit a page belongs to (`useRouter().bfcacheId`).
const router = vi.hoisted(() => ({ bfcacheId: "_b_0_" }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
let visits = 0;
const aVisit = () => {
  router.bfcacheId = `_b_${++visits}_`;
};

function Screen() {
  const counts = useApiQuery<{ all: number }>("/api/follow-ups/counts");
  const orders = useApiPages<string>("/api/appointments");
  return (
    <p>
      {counts.data ? `${counts.data.all} orders` : "counting"} · {orders.data?.join(", ") ?? "listing"}
      {orders.loadingMore && " · more coming"}
    </p>
  );
}

const settled = () => new Promise((settle) => setTimeout(settle, 20));

function renderWith(node: React.ReactNode, cache = new Map()) {
  const view = render(<SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>{node}</SWRConfig>);
  return {
    ...view,
    rerender: (next: React.ReactNode) =>
      view.rerender(<SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>{next}</SWRConfig>),
  };
}

/** What the browser kept from an earlier visit: the counts, and three pages of the list. */
function keptFromBefore() {
  return new Map<string, unknown>([
    ["/api/follow-ups/counts", { data: { all: 1 } }],
    [pageKey("/api/appointments"), { data: [{ items: ["x"] }, { items: ["y"] }, { items: ["z"] }], _l: 3 }],
  ]);
}

beforeEach(() => {
  aVisit();
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
    await settled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("shows it over what the browser kept from the last visit, from the list's first page, and asks nothing", async () => {
    renderWith(
      <ServerData
        queries={{ "/api/follow-ups/counts": { all: 3 } }}
        pages={{ "/api/appointments": { items: ["a", "b"], nextCursor: "c" } }}
      >
        <Screen />
      </ServerData>,
      keptFromBefore(),
    );

    expect(screen.getByText("3 orders · a, b")).toBeInTheDocument();
    await settled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByText("3 orders · a, b")).toBeInTheDocument();
  });

  it("changes nothing when brought back by Back or Forward: the screen shows what the browser has, and asks again", async () => {
    const queries = { "/api/follow-ups/counts": { all: 3 } };
    const pages = { "/api/appointments": { items: ["a"], nextCursor: null } };
    const cache = new Map<string, unknown>();
    const first = renderWith(
      <ServerData queries={queries} pages={pages}>
        <Screen />
      </ServerData>,
      cache,
    );
    expect(screen.getByText("3 orders · a")).toBeInTheDocument();
    first.unmount();
    // Read again in the browser since — a save, a return to the app.
    cache.set("/api/follow-ups/counts", { data: { all: 5 } });
    cache.set(pageKey("/api/appointments"), { data: [{ items: ["b"], nextCursor: null }] });

    // The same visit, its page as it was read then.
    renderWith(
      <ServerData queries={{ ...queries }} pages={{ ...pages }}>
        <Screen />
      </ServerData>,
      cache,
    );

    expect(screen.getByText("5 orders · b")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("9 orders · fresh")).toBeInTheDocument());
    expect(fetcher).toHaveBeenCalledWith("/api/follow-ups/counts");
    expect(fetcher).toHaveBeenCalledWith("/api/appointments");
  });

  it("takes a new visit's data on the same screen without asking for it", async () => {
    const view = renderWith(
      <ServerData queries={{ "/api/follow-ups/counts": { all: 3 } }}>
        <Screen />
      </ServerData>,
    );
    expect(screen.getByText(/^3 orders/)).toBeInTheDocument();
    fetcher.mockClear();

    aVisit();
    view.rerender(
      <ServerData queries={{ "/api/follow-ups/counts": { all: 4 } }}>
        <Screen />
      </ServerData>,
    );

    expect(screen.getByText(/^4 orders/)).toBeInTheDocument();
    await settled();
    expect(fetcher).not.toHaveBeenCalledWith("/api/follow-ups/counts");
  });

  it("puts nothing in the cache from data handed again within the same visit", async () => {
    const queries = { "/api/follow-ups/counts": { all: 3 } };
    const pages = { "/api/appointments": { items: ["a"], nextCursor: null } };
    const view = renderWith(
      <ServerData queries={queries} pages={pages}>
        <Screen />
      </ServerData>,
    );
    expect(screen.getByText("3 orders · a")).toBeInTheDocument();

    view.rerender(
      <ServerData queries={{ "/api/follow-ups/counts": { all: 4 } }} pages={pages}>
        <Screen />
      </ServerData>,
    );
    view.rerender(
      <ServerData queries={{ "/api/follow-ups/counts": { all: 4 } }} pages={{ "/api/appointments": { items: ["b"] } }}>
        <Screen />
      </ServerData>,
    );

    expect(screen.getByText("3 orders · a")).toBeInTheDocument();
    await settled();
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
