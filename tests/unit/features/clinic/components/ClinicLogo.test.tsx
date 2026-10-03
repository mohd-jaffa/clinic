import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClinicLogo } from "@/features/clinic/components/ClinicLogo";

describe("ClinicLogo", () => {
  it("shows the logo straight from the API, named for the clinic", () => {
    render(<ClinicLogo url="/api/clinic/logo?v=1" clinic="Smile Care" size="lg" />);
    const logo = screen.getByRole("img", { name: "Smile Care logo" });
    expect(logo).toHaveAttribute("src", "/api/clinic/logo?v=1");
  });

  it("holds a quiet mark when there is none, and draws nothing small", () => {
    const { container, rerender } = render(<ClinicLogo url={null} clinic="Smile Care" size="lg" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");

    rerender(<ClinicLogo url={null} clinic="Smile Care" size="sm" />);
    expect(container).toBeEmptyDOMElement();
  });
});
