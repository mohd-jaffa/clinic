import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailList } from "@/components/ui/detail-list";

describe("DetailList (D113)", () => {
  it("reads each fact as a term and its value, in the order given", () => {
    render(
      <DetailList
        details={[
          { label: "Mobile", value: "+91 98765 43210" },
          { label: "Address", value: "Flat 4B\n12 MG Road" },
        ]}
      />,
    );
    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    expect(terms).toEqual(["Mobile", "Address"]);
    const address = screen.getAllByRole("definition")[1];
    expect(address).toHaveTextContent("Flat 4B 12 MG Road");
    expect(address).toHaveClass("whitespace-pre-line");
    expect(within(screen.getAllByRole("definition")[0]).getByText("+91 98765 43210")).toBeInTheDocument();
  });
});
