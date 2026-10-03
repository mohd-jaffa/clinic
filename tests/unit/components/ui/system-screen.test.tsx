import { render, screen } from "@testing-library/react";
import { CircleAlert, MapPinOff } from "lucide-react";
import { describe, expect, it } from "vitest";

import { SystemScreen } from "@/components/ui/system-screen";

describe("SystemScreen", () => {
  it("stands on its own: the app's name, its title as the page's heading, why, and a way on", () => {
    render(
      <SystemScreen icon={MapPinOff} tone="land" title="This page isn’t here" body="The link may be out of date.">
        <a href="/home">Go to Home</a>
      </SystemScreen>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveTextContent("ClinicDesk");
    expect(screen.getByRole("heading", { level: 1, name: "This page isn’t here" })).toBeInTheDocument();
    expect(screen.getByText("The link may be out of date.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Home" })).toBeInTheDocument();
  });

  it("gives a reference to quote when there is one, and none when there is not", () => {
    const { rerender } = render(
      <SystemScreen
        icon={CircleAlert}
        tone="attention"
        title="Something went wrong"
        body="Why."
        reference="Reference: 42"
      >
        <button type="button">Try again</button>
      </SystemScreen>,
    );
    expect(screen.getByText("Reference: 42")).toBeInTheDocument();

    rerender(
      <SystemScreen icon={CircleAlert} tone="attention" title="Something went wrong" body="Why.">
        <button type="button">Try again</button>
      </SystemScreen>,
    );
    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
  });
});
