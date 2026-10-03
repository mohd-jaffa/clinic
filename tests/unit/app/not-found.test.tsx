import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/nav/NotFoundScreen", () => ({ NotFoundScreen: () => <p>Not here</p> }));

const { default: NotFound, metadata } = await import("@/app/not-found");

describe("the not-found screen", () => {
  it("draws the not-found screen", () => {
    render(<NotFound />);
    expect(screen.getByText("Not here")).toBeInTheDocument();
  });

  it("names the tab after itself", () => {
    expect(metadata.title).toBe("This page isn’t here");
  });
});
