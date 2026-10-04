import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/ui/page-header";

describe("PageHeader", () => {
  it("is the screen's one first-level heading, with what the screen is for", () => {
    render(<PageHeader title="Patients" subtitle="Everyone the clinic has seen." />);
    expect(screen.getByRole("heading", { level: 1, name: "Patients" })).toBeInTheDocument();
    expect(screen.getByText("Everyone the clinic has seen.")).toHaveClass("text-land-muted");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("offers a way back, named for a screen reader, and keeps its controls beside it", () => {
    render(
      <PageHeader title="Rohan Mehta" back="/patients">
        <button type="button">Edit</button>
      </PageHeader>,
    );
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/patients");
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("adds a second line, and what to do with whom it names, under the title", () => {
    render(
      <PageHeader
        title="Rohan Mehta"
        subtitle="34 y · Male · P-1012"
        detail="Doctor · Rahul Nair"
        actions={<a href="tel:+919876543210">Call</a>}
      />,
    );
    expect(screen.getByText("Doctor · Rahul Nair")).toHaveClass("text-land-muted");
    expect(screen.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+919876543210");
  });
});
