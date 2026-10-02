import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Wordmark } from "@/components/ui/wordmark";
import { UI_TEXT } from "@/constants/messages";

describe("Wordmark", () => {
  it("is the app's name, read as text", () => {
    render(<Wordmark />);
    expect(screen.getByText(UI_TEXT.appName)).toHaveClass("font-bold", "text-title");
  });

  it("comes larger where a screen leads with it", () => {
    render(<Wordmark size="lg" className="text-land-ink" />);
    expect(screen.getByText(UI_TEXT.appName)).toHaveClass("text-heading", "text-land-ink");
  });
});
