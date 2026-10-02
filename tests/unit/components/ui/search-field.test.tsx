import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { SearchField } from "@/components/ui/search-field";

function Search({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <SearchField
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      placeholder="Search patients"
    />
  );
}

describe("SearchField", () => {
  it("is named by its placeholder, so it keeps a name once something is typed", async () => {
    const onChange = vi.fn();
    render(<Search onChange={onChange} />);
    const field = screen.getByRole("searchbox", { name: "Search patients" });

    await userEvent.type(field, "Asha");
    expect(onChange).toHaveBeenLastCalledWith("Asha");
    expect(field).toHaveAccessibleName("Search patients");
  });

  it("offers a way to empty it once something is typed, and is ready for the next name", async () => {
    const onChange = vi.fn();
    render(<Search onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole("searchbox"), "Ro");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });
});
