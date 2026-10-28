import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClinicPills } from "@/features/admin/components/ClinicPills";

describe("ClinicPills (D368, plan §7.6)", () => {
  it("says where a clinic stands, and No trial while it waits", () => {
    const { unmount } = render(<ClinicPills clinic={{ standing: "TRIAL", noTrial: false }} />);
    expect(screen.getByText("Trial")).toBeInTheDocument();
    expect(screen.queryByText("No trial")).not.toBeInTheDocument();
    unmount();
    render(<ClinicPills clinic={{ standing: "READ_ONLY", noTrial: true }} />);
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.getByText("No trial")).toBeInTheDocument();
  });

  it("is one pill on a list's row: No trial in place of View only, else the state", () => {
    const { unmount } = render(<ClinicPills clinic={{ standing: "READ_ONLY", noTrial: true }} brief />);
    expect(screen.getByText("No trial")).toBeInTheDocument();
    expect(screen.queryByText("View only")).not.toBeInTheDocument();
    unmount();
    render(<ClinicPills clinic={{ standing: "ACTIVE", noTrial: false }} brief />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});
