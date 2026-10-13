import { describe, expect, it } from "vitest";
import type { EmailMessage } from "../src/types/email.types.js";
import {
  buildQuotedHtml,
  buildQuotedText,
  buildReplyHeaders,
  buildReplyRecipients,
  buildReplySubject,
  defaultSender,
  generateMessageId,
  normalizeMessageId,
} from "../src/utils/replyUtils.js";

const baseMessage = (overrides: Partial<EmailMessage> = {}): EmailMessage => ({
  id: "<orig@wibank.de>",
  messageId: "<orig@wibank.de>",
  uid: 15120,
  subject: "AW: Nachricht an die WIBank",
  from: [{ name: "PV-Anlagen-Darlehen", address: "pv@wibank.de" }],
  to: [{ address: "advertise+wibank@mailbox.org" }],
  date: new Date("2026-10-07T05:51:18.000Z"),
  flags: [],
  folder: "INBOX",
  ...overrides,
});

describe("replyUtils", () => {
  describe("normalizeMessageId", () => {
    it("should add angle brackets when missing", () => {
      expect(normalizeMessageId("abc@example.com")).toBe("<abc@example.com>");
    });

    it("should keep existing angle brackets", () => {
      expect(normalizeMessageId(" <abc@example.com> ")).toBe(
        "<abc@example.com>",
      );
    });
  });

  describe("generateMessageId", () => {
    it("should generate unique bracketed IDs on the given domain", () => {
      const a = generateMessageId("mailbox.org");
      const b = generateMessageId("mailbox.org");
      expect(a).toMatch(/^<[^<>\s]+@mailbox\.org>$/);
      expect(a).not.toBe(b);
    });
  });

  describe("defaultSender", () => {
    it("should derive a display name from the local part", () => {
      expect(defaultSender("max.mustermann@mailbox.org")).toEqual({
        name: "Max Mustermann",
        address: "max.mustermann@mailbox.org",
      });
    });
  });

  describe("buildReplySubject", () => {
    it("should prefix Re: when no reply prefix exists", () => {
      expect(buildReplySubject("Antrag")).toBe("Re: Antrag");
    });

    it.each([
      "Re: Antrag",
      "AW: Antrag",
      "aw:Antrag",
      "RE : Antrag",
    ])("should keep existing reply prefix in %s", subject => {
      expect(buildReplySubject(subject)).toBe(subject);
    });

    it("should handle empty subjects", () => {
      expect(buildReplySubject("")).toBe("Re:");
    });
  });

  describe("buildReplyHeaders", () => {
    it("should reply to the original Message-ID", () => {
      expect(buildReplyHeaders(baseMessage())).toEqual({
        inReplyTo: "<orig@wibank.de>",
        references: ["<orig@wibank.de>"],
      });
    });

    it("should append the original Message-ID to existing References", () => {
      const headers = buildReplyHeaders(
        baseMessage({ references: ["<first@a.de>", "<second@a.de>"] }),
      );
      expect(headers.references).toEqual([
        "<first@a.de>",
        "<second@a.de>",
        "<orig@wibank.de>",
      ]);
    });

    it("should fall back to In-Reply-To when References is missing", () => {
      const headers = buildReplyHeaders(
        baseMessage({ inReplyTo: "<parent@a.de>" }),
      );
      expect(headers.references).toEqual(["<parent@a.de>", "<orig@wibank.de>"]);
    });

    it("should not duplicate IDs", () => {
      const headers = buildReplyHeaders(
        baseMessage({ references: ["<orig@wibank.de>"] }),
      );
      expect(headers.references).toEqual(["<orig@wibank.de>"]);
    });

    it("should keep the first and the most recent IDs for long chains", () => {
      const references = Array.from({ length: 40 }, (_, i) => `<ref${i}@a.de>`);
      const headers = buildReplyHeaders(baseMessage({ references }));
      expect(headers.references).toHaveLength(20);
      expect(headers.references?.[0]).toBe("<ref0@a.de>");
      expect(headers.references?.at(-1)).toBe("<orig@wibank.de>");
    });

    it("should return no headers when the original has no Message-ID", () => {
      expect(buildReplyHeaders(baseMessage({ messageId: undefined }))).toEqual(
        {},
      );
    });
  });

  describe("buildReplyRecipients", () => {
    const own = ["saschajan@mailbox.org", "advertise+wibank@mailbox.org"];

    it("should reply to the sender", () => {
      expect(buildReplyRecipients(baseMessage(), own, false)).toEqual({
        to: [{ name: "PV-Anlagen-Darlehen", address: "pv@wibank.de" }],
        cc: [],
      });
    });

    it("should prefer Reply-To over From", () => {
      const result = buildReplyRecipients(
        baseMessage({ replyTo: [{ address: "team@wibank.de" }] }),
        own,
        false,
      );
      expect(result.to).toEqual([{ address: "team@wibank.de" }]);
    });

    it("should add other recipients as CC on reply-all without own addresses", () => {
      const result = buildReplyRecipients(
        baseMessage({
          to: [
            { address: "Advertise+wibank@mailbox.org" },
            { address: "pv@wibank.de" },
            { address: "kollege@wibank.de" },
          ],
          cc: [{ address: "saschajan@mailbox.org" }, { address: "cc@a.de" }],
        }),
        own,
        true,
      );
      expect(result.to).toEqual([
        { name: "PV-Anlagen-Darlehen", address: "pv@wibank.de" },
      ]);
      expect(result.cc).toEqual([
        { address: "kollege@wibank.de" },
        { address: "cc@a.de" },
      ]);
    });

    it("should reply to the original recipients when replying to own mail", () => {
      const result = buildReplyRecipients(
        baseMessage({
          from: [{ address: "saschajan@mailbox.org" }],
          to: [{ address: "pv@wibank.de" }],
        }),
        own,
        false,
      );
      expect(result.to).toEqual([{ address: "pv@wibank.de" }]);
    });
  });

  describe("quoting", () => {
    it("should quote plain text line by line", () => {
      const quoted = buildQuotedText(baseMessage({ text: "Zeile 1\nZeile 2" }));
      expect(quoted).toContain("PV-Anlagen-Darlehen <pv@wibank.de> wrote:");
      expect(quoted).toContain("> Zeile 1\n> Zeile 2");
    });

    it("should wrap the original HTML in a blockquote", () => {
      const quoted = buildQuotedHtml(baseMessage({ html: "<p>Hallo</p>" }));
      expect(quoted).toContain("<blockquote");
      expect(quoted).toContain("<p>Hallo</p>");
    });

    it("should escape plain text when no HTML exists", () => {
      const quoted = buildQuotedHtml(baseMessage({ text: "a < b" }));
      expect(quoted).toContain("a &lt; b");
    });
  });
});
