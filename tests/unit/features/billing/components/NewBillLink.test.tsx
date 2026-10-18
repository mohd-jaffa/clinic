import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";

const { auth } = vi.hoisted(() => ({ auth: { current: {} as ReturnType<typeof authStub> } }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));

const { NewBillLink } = await import("@/features/billing/components/NewBillLink");

const asha = { name: "Asha Rao", archived: false };

beforeEach(() => {
  auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.create"] });
});

describe("NewBillLink (plan §15.2; D307, D311)", () => {
  it("is Bill now at the foot of a visit, and New bill on a profile", () => {
    const { unmount } = render(<NewBillLink target={{ visit: "v-1" }} patient={asha} look="visit" />);
    expect(screen.getByRole("link", { name: "Bill Asha Rao’s visit" })).toHaveAttribute(
      "href",
      "/billing/new?visit=v-1",
    );
    unmount();
    render(<NewBillLink target={{ patient: "p-1" }} patient={asha} look="profile" />);
    expect(screen.getByRole("link", { name: "New bill for Asha Rao" })).toHaveAttribute(
      "href",
      "/billing/new?patient=p-1",
    );
  });

  it("is not there without payments.create, for an archived patient, signed out, or in a view-only clinic", () => {
    const shown = () => {
      const { container, unmount } = render(<NewBillLink target={{ patient: "p-1" }} patient={asha} look="profile" />);
      const any = container.childElementCount > 0;
      unmount();
      return any;
    };
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "payments.view"] });
    expect(shown()).toBe(false);
    auth.current = { ...authStub(), membership: null };
    expect(shown()).toBe(false);
    const stub = authStub();
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    expect(shown()).toBe(false);
    auth.current = authStub();
    const { container } = render(
      <NewBillLink target={{ patient: "p-1" }} patient={{ ...asha, archived: true }} look="profile" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
