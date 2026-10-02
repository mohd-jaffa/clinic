import { describe, expect, it } from "vitest";
import { z } from "zod";

import { PASSWORD_LENGTH, TEXT_LIMITS } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import {
  firstIssue,
  indianMobile,
  isPhoneNumber,
  optionalEmail,
  optionalLine,
  optionalLines,
  optionalPhoneNumber,
  paiseAmount,
  paiseText,
  password,
  quantity,
  requiredEmail,
  requiredLine,
  requiredLines,
} from "@/lib/validation/primitives";

function messageOf(schema: z.ZodType, value: unknown): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : firstIssue(result.error);
}

describe("optionalLine", () => {
  const schema = optionalLine("Reference", 10);

  it("treats missing, blank and null as nothing", () => {
    expect(schema.parse(undefined)).toBeNull();
    expect(schema.parse("")).toBeNull();
    expect(schema.parse("   ")).toBeNull();
    expect(schema.parse("\u200B")).toBeNull();
    expect(schema.parse(null)).toBeNull();
  });

  it("keeps one tidy line of what it is given", () => {
    expect(schema.parse("  UPI\t 3248 ")).toBe("UPI 3248");
  });

  it("refuses more than its column holds, counted after tidying", () => {
    expect(messageOf(schema, "x".repeat(11))).toBe(VALIDATION_MESSAGES.tooLong("Reference", 10));
    expect(schema.parse("  " + "x".repeat(10) + "  ")).toBe("x".repeat(10));
  });

  it("can parse its own output again, as the server does after the client", () => {
    expect(schema.parse(schema.parse("hello"))).toBe("hello");
    expect(schema.parse(schema.parse(""))).toBeNull();
  });
});

describe("optionalLines", () => {
  const schema = optionalLines("Address", 100);

  it("keeps the line breaks an address needs", () => {
    expect(schema.parse("Flat 302\r\nSunrise Apartments  \r\nM.G. Road")).toBe(
      "Flat 302\nSunrise Apartments\nM.G. Road",
    );
  });

  it("leaves a blank one null", () => {
    expect(schema.parse(" \n \n ")).toBeNull();
  });
});

describe("optionalEmail", () => {
  const schema = optionalEmail("Email");

  it("accepts an address and leaves a blank one null", () => {
    expect(schema.parse("meena@example.com")).toBe("meena@example.com");
    expect(schema.parse("")).toBeNull();
  });

  it("names the field when the shape is wrong", () => {
    expect(messageOf(schema, "meena@")).toBe(VALIDATION_MESSAGES.email("Email"));
  });
});

describe("paiseText", () => {
  const schema = paiseText("Price");

  it("stores what was typed in rupees as whole paise", () => {
    expect(schema.parse("19.99")).toBe(1999);
    expect(schema.parse("500")).toBe(50000);
  });

  it("says a blank field is missing", () => {
    expect(messageOf(schema, "")).toBe(VALIDATION_MESSAGES.required("Price"));
  });

  it("refuses an amount that is not an amount", () => {
    expect(messageOf(schema, "five hundred")).toBe(VALIDATION_MESSAGES.amount("Price"));
    expect(messageOf(schema, "₹")).toBe(VALIDATION_MESSAGES.amount("Price"));
    expect(messageOf(schema, "12.345")).toBe(VALIDATION_MESSAGES.amount("Price"));
  });

  it("accepts money the way people write it", () => {
    expect(schema.parse("₹1,500")).toBe(150000);
    expect(schema.parse("1,00,000.50")).toBe(10000050);
    expect(schema.parse(" ₹ 250 ")).toBe(25000);
  });

  it("stops at ₹10,00,000, so it fits its column", () => {
    expect(schema.parse("10,00,000")).toBe(100_000_000);
    expect(messageOf(schema, "10,00,000.01")).toBe(VALIDATION_MESSAGES.tooLarge("Price", "₹10,00,000"));
    expect(messageOf(schema, "99999999999999")).toBe(VALIDATION_MESSAGES.tooLarge("Price", "₹10,00,000"));
  });
});

describe("paiseAmount", () => {
  it("takes whole paise within the field's bounds", () => {
    expect(paiseAmount("Amount").parse(50000)).toBe(50000);
    expect(messageOf(paiseAmount("Amount"), 0)).toBe(VALIDATION_MESSAGES.moreThanZero("Amount"));
    expect(paiseAmount("Price", { allowZero: true }).parse(0)).toBe(0);
    expect(messageOf(paiseAmount("Price", { allowZero: true }), -1)).toBe(VALIDATION_MESSAGES.notNegative("Price"));
    expect(messageOf(paiseAmount("Amount"), 100_000_001)).toBe(VALIDATION_MESSAGES.tooLarge("Amount", "₹10,00,000"));
  });

  it("names the field when it is not a number at all", () => {
    expect(messageOf(paiseAmount("Amount"), "500")).toBe(VALIDATION_MESSAGES.amount("Amount"));
    expect(messageOf(paiseAmount("Amount"), 12.5)).toBe(VALIDATION_MESSAGES.wholeNumber("Amount"));
  });
});

describe("quantity", () => {
  it("is a whole number from 1 to 999, a bill line's bound (plan §28.6)", () => {
    expect(quantity().parse(3)).toBe(3);
    expect(messageOf(quantity(), 0)).toBe(VALIDATION_MESSAGES.moreThanZero("Quantity"));
    expect(messageOf(quantity(), 1.5)).toBe(VALIDATION_MESSAGES.wholeNumber("Quantity"));
    expect(quantity().parse(999)).toBe(999);
    expect(messageOf(quantity(), 1_000)).toBe(VALIDATION_MESSAGES.tooLarge("Quantity", "999"));
  });

  it("says an emptied field is missing, instead of Zod's NaN message", () => {
    expect(messageOf(quantity(), Number.NaN)).toBe(VALIDATION_MESSAGES.required("Quantity"));
    expect(messageOf(quantity(), undefined)).toBe(VALIDATION_MESSAGES.required("Quantity"));
  });
});

describe("requiredLine", () => {
  const schema = requiredLine("Name", { min: 2, max: 5 });

  it("keeps one tidy line and names the field in each refusal", () => {
    expect(schema.parse("  Anu ")).toBe("Anu");
    expect(messageOf(schema, "   ")).toBe(VALIDATION_MESSAGES.required("Name"));
    expect(messageOf(schema, "A")).toBe(VALIDATION_MESSAGES.tooShort("Name", 2));
    expect(messageOf(schema, "Priyanka")).toBe(VALIDATION_MESSAGES.tooLong("Name", 5));
    expect(messageOf(schema, undefined)).toBe(VALIDATION_MESSAGES.required("Name"));
  });

  it("makes a name pasted from a chat app the same as one typed by hand", () => {
    expect(schema.parse("A\u200Bnu")).toBe("Anu");
    expect(schema.parse("Anu\u00A0")).toBe("Anu");
  });
});

describe("requiredLines", () => {
  const schema = requiredLines("Address", { max: 50 });

  it("needs something besides blank lines", () => {
    expect(messageOf(schema, "\n\n")).toBe(VALIDATION_MESSAGES.required("Address"));
    expect(schema.parse("12 Rose Street\nKochi")).toBe("12 Rose Street\nKochi");
  });
});

describe("firstIssue", () => {
  it("is what a single field shows", () => {
    const result = z.object({ name: z.string().min(1, "Name needs a value.") }).safeParse({ name: "" });
    expect(result.success ? "" : firstIssue(result.error)).toBe("Name needs a value.");
  });
});

describe("requiredEmail", () => {
  const email = requiredEmail("Email address");

  it("lower-cases what was typed, so it matches the column it is stored in", () => {
    expect(email.parse("  ASHA@Example.COM ")).toBe("asha@example.com");
  });

  it("insists on one", () => {
    expect(email.safeParse("").success).toBe(false);
  });

  it("refuses something that is not an address", () => {
    const result = email.safeParse("asha@example");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstIssue(result.error)).toBe(VALIDATION_MESSAGES.email("Email address"));
    }
  });

  it("refuses one longer than the column can hold", () => {
    expect(email.safeParse(`${"a".repeat(250)}@example.com`).success).toBe(false);
  });
});

describe("indianMobile", () => {
  const schema = indianMobile();

  it("stores a number in one shape however it was typed (plan §5.2)", () => {
    for (const typed of ["9876543210", "98765 43210", "+91 98765 43210", "09876543210", "919876543210"]) {
      expect(schema.parse(typed)).toBe("+919876543210");
    }
  });

  it("says a blank one is missing, naming the field", () => {
    expect(messageOf(indianMobile("Clinic phone"), "  ")).toBe(VALIDATION_MESSAGES.required("Clinic phone"));
  });

  it("refuses a number that is not an Indian mobile", () => {
    for (const typed of ["12345", "5876543210", "+44 7700 900123"]) {
      expect(messageOf(schema, typed)).toBe(VALIDATION_MESSAGES.phone);
    }
  });
});

describe("quantity and firstIssue, given the unexpected", () => {
  it("says a quantity that is not a number must be a whole number", () => {
    expect(messageOf(quantity(), "3")).toBe(VALIDATION_MESSAGES.wholeNumber("Quantity"));
  });

  it("falls back to the catalogue's own word when a failure names no issue", () => {
    expect(firstIssue(new z.ZodError([]))).toBe(VALIDATION_MESSAGES.invalid);
  });
});

describe("optionalPhoneNumber", () => {
  const schema = optionalPhoneNumber("Clinic phone");

  it("keeps a mobile or a landline as it was typed, tidied, and nothing as nothing", () => {
    expect(schema.parse(" 0484  234 5678 ")).toBe("0484 234 5678");
    expect(schema.parse("+91 98765-43210")).toBe("+91 98765-43210");
    expect(schema.parse("(0484) 2345678")).toBe("(0484) 2345678");
    expect(schema.parse("")).toBeNull();
  });

  it("refuses what is not a phone number, naming the field", () => {
    for (const typed of ["call me", "12345", "1234567890123456", "98765+43210"]) {
      expect(messageOf(schema, typed), typed).toBe(VALIDATION_MESSAGES.phoneNumber("Clinic phone"));
    }
    expect(messageOf(schema, "1".repeat(TEXT_LIMITS.phoneNumber + 1))).toBe(
      VALIDATION_MESSAGES.tooLong("Clinic phone", TEXT_LIMITS.phoneNumber),
    );
  });
});

describe("isPhoneNumber", () => {
  it("counts 6 to 15 digits, whatever stands between them", () => {
    expect(isPhoneNumber("123456")).toBe(true);
    expect(isPhoneNumber("12345")).toBe(false);
    expect(isPhoneNumber("+123456789012345")).toBe(true);
    expect(isPhoneNumber("+1234567890123456")).toBe(false);
  });
});

describe("password", () => {
  const schema = password("New password");

  it("keeps a password exactly as typed, spaces and all", () => {
    expect(schema.parse("  pass word  ")).toBe("  pass word  ");
  });

  it("says a missing, short or overlong one in the field's name", () => {
    expect(messageOf(schema, "")).toBe(VALIDATION_MESSAGES.required("New password"));
    expect(messageOf(schema, undefined)).toBe(VALIDATION_MESSAGES.required("New password"));
    expect(messageOf(schema, "a".repeat(PASSWORD_LENGTH.min - 1))).toBe(
      VALIDATION_MESSAGES.tooShort("New password", PASSWORD_LENGTH.min),
    );
    expect(messageOf(schema, "a".repeat(PASSWORD_LENGTH.max + 1))).toBe(
      VALIDATION_MESSAGES.tooLong("New password", PASSWORD_LENGTH.max),
    );
  });

  it("is called Password unless named", () => {
    expect(messageOf(password(), "")).toBe(VALIDATION_MESSAGES.required("Password"));
  });
});
