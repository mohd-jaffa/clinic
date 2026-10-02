import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Users } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen, type ListQuery } from "@/components/ui/list-screen";
import { ERROR_MESSAGES } from "@/constants/messages";
import { notFoundError } from "@/lib/errors";

interface Patient {
  id: string;
  name: string;
}

function list({ query, data, noMatches }: { query?: Partial<ListQuery>; data?: Patient[]; noMatches?: string }) {
  return render(
    <ListScreen<Patient>
      query={{ isLoading: false, error: undefined, mutate: vi.fn(), ...query }}
      loadFailed="INTERNAL_ERROR"
      data={data}
      renderList={(items) => (
        <ul>
          {items.map((item) => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
      )}
      empty={<EmptyState icon={Users} title="No patients yet" />}
      noMatches={noMatches}
    >
      <p>Below the rows</p>
    </ListScreen>,
  );
}

describe("ListScreen", () => {
  it("stands in with rows while it first loads, and says so", () => {
    list({ query: { isLoading: true } });
    expect(screen.getByLabelText("Loading…")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("says why a first load failed, in the app's own words", () => {
    list({ query: { error: new TypeError("Failed to fetch") } });
    expect(screen.getByRole("alert")).toHaveTextContent(ERROR_MESSAGES.INTERNAL_ERROR);
  });

  it("prefers the failure's own words when it has them", () => {
    list({ query: { error: notFoundError("RECORD_NOT_FOUND") } });
    expect(screen.getByRole("alert")).toHaveTextContent(ERROR_MESSAGES.RECORD_NOT_FOUND);
  });

  it("offers a way to try again, and does", async () => {
    const mutate = vi.fn();
    list({ query: { error: new Error("offline"), mutate } });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalledOnce();
  });

  it("has no way to try again where there is nothing to retry", () => {
    list({ query: { error: new Error("offline"), mutate: undefined } });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says what is missing when the clinic has none yet, or that nothing matches", () => {
    const { unmount } = list({ data: [] });
    expect(screen.getByRole("heading", { name: "No patients yet" })).toBeInTheDocument();
    unmount();
    list({ data: [], noMatches: "No one matches “Ro”." });
    expect(screen.getByText("No one matches “Ro”.")).toBeInTheDocument();
  });

  it("shows the rows, what is below them, and Show more while another page follows", async () => {
    const loadMore = vi.fn();
    list({ data: [{ id: "1", name: "Asha" }], query: { hasMore: true, loadMore } });
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("Below the rows")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(loadMore).toHaveBeenCalledOnce();
  });

  it("keeps showing what it has when a later load fails", () => {
    list({ data: [{ id: "1", name: "Asha" }], query: { error: new Error("offline") } });
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });
});
