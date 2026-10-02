import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScreenSkeleton, Skeleton, SkeletonRows } from "@/components/ui/skeleton";

describe("Skeleton", () => {
  it("stands in, hidden from a screen reader, sized where it is told", () => {
    const { container } = render(<Skeleton className="h-24" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild).toHaveClass("h-24");
  });

  it("stands in for rows, three unless told", () => {
    const { container, rerender } = render(<SkeletonRows />);
    expect(container.querySelectorAll("[aria-hidden='true']")).toHaveLength(3);
    rerender(<SkeletonRows rows={5} />);
    expect(container.querySelectorAll("[aria-hidden='true']")).toHaveLength(5);
  });
});

describe("ScreenSkeleton", () => {
  it("draws the land first, then the rows, and says it is loading once", () => {
    const { container } = render(<ScreenSkeleton label="Loading the queue" />);
    expect(screen.getByRole("status", { name: "Loading the queue" })).toBeInTheDocument();
    expect(container.querySelector(".bg-land")).not.toBeNull();
    expect(container.querySelectorAll(".rounded-row")).toHaveLength(4);
  });
});
