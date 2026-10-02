import { describe, expect, it } from "vitest";

import { UI_TEXT } from "@/constants/messages";
import { emailHtml, emailText, escapeHtml, type EmailParts } from "@/lib/mail/templates/layout";

const parts: EmailParts = {
  appUrl: "https://clinicdesk.test/",
  subject: "A subject",
  preheader: "Seen before it is opened",
  heading: "A heading",
  paragraphs: ["Hi <Asha>,", "The body."],
  footnote: "Why this came.",
};

describe("escapeHtml", () => {
  it("makes what a person typed safe in HTML", () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe("&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;");
  });
});

describe("emailHtml", () => {
  it("leads with the app's name to its address, the words escaped, light only", () => {
    const html = emailHtml(parts);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<title>A subject</title>");
    expect(html).toContain(`<a href="https://clinicdesk.test"`);
    expect(html).toContain(`>${UI_TEXT.appName}</a>`);
    expect(html).toContain("Seen before it is opened");
    expect(html).toContain(">A heading</h1>");
    expect(html).toContain("Hi &lt;Asha&gt;,");
    expect(html).not.toContain("<Asha>");
    expect(html).toContain("Why this came.");
    // A mail app's dark mode does not repaint it.
    expect(html).toContain('<meta name="color-scheme" content="light only">');
    // Nothing is fetched when it is opened.
    expect(html).not.toMatch(/<img|https:\/\/fonts\./);
  });

  it("adds a button with its address in words, and a note, only when given", () => {
    expect(emailHtml(parts)).not.toContain("go?a=1");
    const html = emailHtml({
      ...parts,
      action: { label: "Go", url: "https://clinicdesk.test/go?a=1&b=2", fallback: "Or this link:" },
      note: "Works for a day.",
    });
    expect(html).toContain('href="https://clinicdesk.test/go?a=1&amp;b=2"');
    expect(html).toContain(">Go</a>");
    expect(html).toContain("Or this link:");
    expect(html).toContain("Works for a day.");
  });
});

describe("emailText", () => {
  it("says the same in plain text", () => {
    expect(emailText(parts)).toBe(
      ["Hi <Asha>,", "", "The body.", "", "—", UI_TEXT.appName, "Why this came."].join("\n"),
    );
    const text = emailText({
      ...parts,
      action: { label: "Go", url: "https://clinicdesk.test/go", fallback: "Or this link:" },
      note: "Works for a day.",
    });
    expect(text).toContain("Go: https://clinicdesk.test/go");
    expect(text).toContain("Works for a day.");
  });
});
