import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthScene, OtherWayIn } from "@/features/auth/components/AuthScene";

describe("AuthScene", () => {
  it("leads with the land — the app's name and its line — then the screen's title, its line, the form and the other way in", () => {
    render(
      <AuthScene title="Sign in" intro="With your email or your mobile number." aside={<p>New here?</p>}>
        <form aria-label="Sign in form" />
      </AuthScene>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveTextContent("ClinicDesk");
    expect(main).toHaveTextContent("The front desk and consulting room of your clinic, on any device.");
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).not.toHaveFocus();
    expect(screen.getByText("With your email or your mobile number.")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Sign in form" })).toBeInTheDocument();
    expect(screen.getByText("New here?")).toBeInTheDocument();
  });

  it("takes the focus to its title when the screen has just become another", () => {
    render(
      <AuthScene title="Check your email" announce>
        <p>Sent.</p>
      </AuthScene>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Check your email" })).toHaveFocus();
  });
});

describe("OtherWayIn", () => {
  it("asks, and offers the way", () => {
    render(<OtherWayIn question="New here?" label="Set up your clinic" href="/register" />);
    expect(screen.getByText("New here?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up your clinic" })).toHaveAttribute("href", "/register");
  });

  it("goes without the question", () => {
    const { container } = render(<OtherWayIn label="Back to sign in" href="/login" />);
    expect(container.querySelector("p")).toBeNull();
  });
});
