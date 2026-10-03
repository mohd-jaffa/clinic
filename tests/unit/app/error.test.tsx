import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ScreenError from "@/app/error";

describe("the error screen", () => {
  it("says the screen failed and that what was saved is safe, with the reference to quote, never the error's words", () => {
    const error = Object.assign(new Error("relation patients does not exist"), { digest: "3141592653" });
    render(<ScreenError error={error} retry={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText(/Anything you had already saved is safe/)).toBeInTheDocument();
    expect(screen.getByText("Reference: 3141592653")).toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveTextContent("relation patients");
  });

  it("tries again, or leads home", async () => {
    const retry = vi.fn();
    render(<ScreenError error={new Error("boom")} retry={retry} />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/home");
    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
  });
});
