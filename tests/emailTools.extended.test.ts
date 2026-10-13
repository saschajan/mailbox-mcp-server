import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailService } from "../src/services/EmailService.js";
import type { SmtpService } from "../src/services/SmtpService.js";
import { handleEmailTool } from "../src/tools/emailTools.js";
import type { EmailMessage } from "../src/types/email.types.js";

vi.mock("../src/services/EmailService.js");
vi.mock("../src/services/SmtpService.js");

describe("Email Tools - Extended Coverage", () => {
  let mockEmailService: Partial<EmailService>;
  let mockSmtpService: Partial<SmtpService>;

  const mockEmail: EmailMessage = {
    id: "msg-1",
    uid: 123,
    subject: "Test Subject",
    from: [{ name: "Test Sender", address: "sender@example.com" }],
    to: [{ name: "Test Recipient", address: "recipient@example.com" }],
    date: new Date("2024-01-01T10:00:00Z"),
    text: "Test email content",
    flags: [],
    folder: "INBOX",
  };

  beforeEach(() => {
    mockEmailService = {
      searchEmails: vi.fn(),
      getEmail: vi.fn(),
      getEmailThread: vi.fn(),
      getFolders: vi.fn(),
      createDirectory: vi.fn(),
      createDraft: vi.fn(),
      moveEmail: vi.fn(),
      markEmail: vi.fn(),
      deleteEmail: vi.fn(),
      appendToSent: vi.fn().mockResolvedValue(undefined),
      getAccountAddress: vi.fn().mockReturnValue("me@mailbox.org"),
    };

    mockSmtpService = {
      sendEmail: vi.fn(),
    };
  });

  describe("send_email", () => {
    it("should send email successfully", async () => {
      vi.mocked(mockSmtpService.sendEmail!).mockResolvedValue({
        success: true,
        message: "Email sent",
        messageId: "msg-123",
      });

      const result = await handleEmailTool(
        "send_email",
        {
          to: [{ address: "recipient@example.com", name: "Recipient" }],
          subject: "Test Email",
          text: "This is a test",
        },
        mockEmailService as EmailService,
        mockSmtpService as SmtpService,
      );

      expect(mockSmtpService.sendEmail).toHaveBeenCalledWith({
        to: [{ address: "recipient@example.com", name: "Recipient" }],
        subject: "Test Email",
        text: "This is a test",
        cc: undefined,
        bcc: undefined,
        html: undefined,
        messageId: expect.stringMatching(/^<[^<>\s]+@mailbox\.org>$/),
      });
      expect(result.content[0].text).toContain("✅ Email sent successfully!");
      expect(result.content[0].text).toContain("Test Email");
      expect(result.isError).toBe(false);
    });

    it("should send email with CC and BCC", async () => {
      vi.mocked(mockSmtpService.sendEmail!).mockResolvedValue({
        success: true,
        message: "Email sent",
      });

      await handleEmailTool(
        "send_email",
        {
          to: [{ address: "recipient@example.com" }],
          cc: [{ address: "cc@example.com" }],
          bcc: [{ address: "bcc@example.com" }],
          subject: "Test",
          text: "Body",
        },
        mockEmailService as EmailService,
        mockSmtpService as SmtpService,
      );

      expect(mockSmtpService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: [{ address: "cc@example.com" }],
          bcc: [{ address: "bcc@example.com" }],
        }),
      );
    });

    it("should send email with HTML body", async () => {
      vi.mocked(mockSmtpService.sendEmail!).mockResolvedValue({
        success: true,
        message: "Email sent",
      });

      await handleEmailTool(
        "send_email",
        {
          to: [{ address: "recipient@example.com" }],
          subject: "HTML Test",
          html: "<p>HTML content</p>",
        },
        mockEmailService as EmailService,
        mockSmtpService as SmtpService,
      );

      expect(mockSmtpService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: "<p>HTML content</p>",
        }),
      );
    });

    it("should handle send failure", async () => {
      vi.mocked(mockSmtpService.sendEmail!).mockResolvedValue({
        success: false,
        message: "SMTP authentication failed",
      });

      const result = await handleEmailTool(
        "send_email",
        {
          to: [{ address: "recipient@example.com" }],
          subject: "Test",
          text: "Body",
        },
        mockEmailService as EmailService,
        mockSmtpService as SmtpService,
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("❌ Failed to send email");
    });

    it("should handle missing SMTP service", async () => {
      const result = await handleEmailTool(
        "send_email",
        {
          to: [{ address: "recipient@example.com" }],
          subject: "Test",
          text: "Body",
        },
        mockEmailService as EmailService,
        undefined, // No SMTP service
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("SMTP service not available");
    });
  });

  describe("create_draft", () => {
    it("should create draft successfully", async () => {
      vi.mocked(mockEmailService.createDraft!).mockResolvedValue({
        success: true,
        message: "Draft saved",
        uid: 456,
      });

      const result = await handleEmailTool(
        "create_draft",
        {
          to: [{ address: "recipient@example.com" }],
          subject: "Draft Subject",
          text: "Draft body",
        },
        mockEmailService as EmailService,
      );

      expect(mockEmailService.createDraft).toHaveBeenCalled();
      expect(result.content[0].text).toContain("✅ Draft saved successfully!");
      expect(result.isError).toBe(false);
    });

    it("should create draft in custom folder", async () => {
      vi.mocked(mockEmailService.createDraft!).mockResolvedValue({
        success: true,
        message: "Draft saved",
      });

      await handleEmailTool(
        "create_draft",
        {
          to: [{ address: "recipient@example.com" }],
          subject: "Draft",
          text: "Body",
          folder: "Custom Drafts",
        },
        mockEmailService as EmailService,
      );

      const calls = vi.mocked(mockEmailService.createDraft!).mock.calls;
      expect(calls[0][1]).toBe("Custom Drafts");
    });

    it("should handle draft creation failure", async () => {
      vi.mocked(mockEmailService.createDraft!).mockResolvedValue({
        success: false,
        message: "Drafts folder not found",
      });

      const result = await handleEmailTool(
        "create_draft",
        {
          to: [{ address: "recipient@example.com" }],
          subject: "Draft",
          text: "Body",
        },
        mockEmailService as EmailService,
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("❌ Failed to save draft");
    });
  });

  describe("move_email", () => {
    it("should move email successfully", async () => {
      vi.mocked(mockEmailService.moveEmail!).mockResolvedValue({
        success: true,
        message: "Email moved",
      });

      const result = await handleEmailTool(
        "move_email",
        {
          uid: 123,
          fromFolder: "INBOX",
          toFolder: "Archive",
        },
        mockEmailService as EmailService,
      );

      expect(mockEmailService.moveEmail).toHaveBeenCalledWith(
        123,
        "INBOX",
        "Archive",
      );
      expect(result.content[0].text).toContain("✅ Email moved successfully!");
      expect(result.isError).toBe(false);
    });

    it("should handle move failure", async () => {
      vi.mocked(mockEmailService.moveEmail!).mockResolvedValue({
        success: false,
        message: "Destination folder not found",
      });

      const result = await handleEmailTool(
        "move_email",
        {
          uid: 123,
          fromFolder: "INBOX",
          toFolder: "NonExistent",
        },
        mockEmailService as EmailService,
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("❌ Failed to move email");
    });
  });

  describe("mark_email", () => {
    it("should mark email as read", async () => {
      vi.mocked(mockEmailService.markEmail!).mockResolvedValue({
        success: true,
        message: "Email marked",
      });

      const result = await handleEmailTool(
        "mark_email",
        {
          uid: 123,
          folder: "INBOX",
          flags: ["\\Seen"],
          action: "add",
        },
        mockEmailService as EmailService,
      );

      expect(mockEmailService.markEmail).toHaveBeenCalledWith(
        123,
        "INBOX",
        ["\\Seen"],
        "add",
      );
      expect(result.content[0].text).toContain(
        "✅ Email flags updated successfully!",
      );
      expect(result.isError).toBe(false);
    });

    it("should mark email as unread", async () => {
      vi.mocked(mockEmailService.markEmail!).mockResolvedValue({
        success: true,
        message: "Email marked",
      });

      await handleEmailTool(
        "mark_email",
        {
          uid: 123,
          folder: "INBOX",
          flags: ["\\Seen"],
          action: "remove",
        },
        mockEmailService as EmailService,
      );

      expect(mockEmailService.markEmail).toHaveBeenCalledWith(
        123,
        "INBOX",
        ["\\Seen"],
        "remove",
      );
    });

    it("should mark email with multiple flags", async () => {
      vi.mocked(mockEmailService.markEmail!).mockResolvedValue({
        success: true,
        message: "Email marked",
      });

      await handleEmailTool(
        "mark_email",
        {
          uid: 123,
          folder: "INBOX",
          flags: ["\\Seen", "\\Flagged"],
          action: "add",
        },
        mockEmailService as EmailService,
      );

      expect(mockEmailService.markEmail).toHaveBeenCalledWith(
        123,
        "INBOX",
        ["\\Seen", "\\Flagged"],
        "add",
      );
    });

    it("should handle mark failure", async () => {
      vi.mocked(mockEmailService.markEmail!).mockResolvedValue({
        success: false,
        message: "Email not found",
      });

      const result = await handleEmailTool(
        "mark_email",
        {
          uid: 999,
          folder: "INBOX",
          flags: ["\\Seen"],
          action: "add",
        },
        mockEmailService as EmailService,
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "❌ Failed to update email flags",
      );
    });
  });

  describe("delete_email", () => {
    it("should delete email (soft delete)", async () => {
      vi.mocked(mockEmailService.deleteEmail!).mockResolvedValue({
        success: true,
        message: "Email moved to trash",
      });

      const result = await handleEmailTool(
        "delete_email",
        {
          uid: 123,
          folder: "INBOX",
        },
        mockEmailService as EmailService,
      );

      expect(mockEmailService.deleteEmail).toHaveBeenCalledWith(
        123,
        "INBOX",
        false,
      );
      expect(result.content[0].text).toContain(
        "✅ Email deleted successfully!",
      );
      expect(result.isError).toBe(false);
    });

    it("should delete email permanently", async () => {
      vi.mocked(mockEmailService.deleteEmail!).mockResolvedValue({
        success: true,
        message: "Email permanently deleted",
      });

      await handleEmailTool(
        "delete_email",
        {
          uid: 123,
          folder: "INBOX",
          permanent: true,
        },
        mockEmailService as EmailService,
      );

      expect(mockEmailService.deleteEmail).toHaveBeenCalledWith(
        123,
        "INBOX",
        true,
      );
    });

    it("should handle delete failure", async () => {
      vi.mocked(mockEmailService.deleteEmail!).mockResolvedValue({
        success: false,
        message: "Email not found",
      });

      const result = await handleEmailTool(
        "delete_email",
        {
          uid: 999,
          folder: "INBOX",
        },
        mockEmailService as EmailService,
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("❌ Failed to delete email");
    });
  });

  describe("get_folders", () => {
    it("should list folders successfully", async () => {
      vi.mocked(mockEmailService.getFolders!).mockResolvedValue([
        {
          name: "INBOX",
          path: "INBOX",
          delimiter: "/",
          flags: [],
          specialUse: undefined,
        },
        {
          name: "Sent",
          path: "Sent",
          delimiter: "/",
          flags: [],
          specialUse: "\\Sent",
        },
        {
          name: "Drafts",
          path: "Drafts",
          delimiter: "/",
          flags: [],
          specialUse: "\\Drafts",
        },
      ]);

      const result = await handleEmailTool(
        "get_folders",
        {},
        mockEmailService as EmailService,
      );

      expect(mockEmailService.getFolders).toHaveBeenCalled();
      expect(result.content[0].text).toContain("📁 Available Email Folders");
      expect(result.content[0].text).toContain("INBOX");
      expect(result.content[0].text).toContain("Sent");
      expect(result.content[0].text).toContain("Drafts");
      expect(result.isError).toBeUndefined();
    });

    it("should handle empty folder list", async () => {
      vi.mocked(mockEmailService.getFolders!).mockResolvedValue([]);

      const result = await handleEmailTool(
        "get_folders",
        {},
        mockEmailService as EmailService,
      );

      expect(result.content[0].text).toContain("(0)");
    });
  });

  describe("threading and sender alias", () => {
    const original: EmailMessage = {
      id: "<reply-123@wibank.de>",
      messageId: "<reply-123@wibank.de>",
      inReplyTo: "<request-1@wibank.de>",
      references: ["<request-1@wibank.de>"],
      uid: 15120,
      subject: "AW: Nachricht an die WIBank",
      from: [{ name: "PV-Anlagen-Darlehen", address: "pv@wibank.de" }],
      to: [
        { address: "alias+wibank@mailbox.org" },
        { name: "PV-Anlagen-Darlehen", address: "pv@wibank.de" },
      ],
      cc: [{ name: "Kollege", address: "kollege@wibank.de" }],
      date: new Date("2026-10-07T05:51:18.000Z"),
      text: "Sehr geehrter Herr Born,\nvielen Dank.",
      flags: [],
      folder: "INBOX",
    };

    it("send_email should use the same Message-ID for SMTP and the Sent copy", async () => {
      vi.mocked(mockSmtpService.sendEmail!).mockResolvedValue({
        success: true,
        message: "Email sent",
      });

      await handleEmailTool(
        "send_email",
        {
          from: { name: "Max", address: "alias+wibank@mailbox.org" },
          to: [{ address: "pv@wibank.de" }],
          subject: "Test",
          text: "Hallo",
        },
        mockEmailService as EmailService,
        mockSmtpService as SmtpService,
      );

      const sent = vi.mocked(mockSmtpService.sendEmail!).mock.calls[0][0];
      const stored = vi.mocked(mockEmailService.appendToSent!).mock.calls[0][0];
      expect(sent.from).toEqual({
        name: "Max",
        address: "alias+wibank@mailbox.org",
      });
      expect(sent.messageId).toMatch(/@mailbox\.org>$/);
      expect(stored.messageId).toBe(sent.messageId);
      expect(stored.from).toEqual(sent.from);
    });

    it("send_email should normalize and pass reply headers", async () => {
      vi.mocked(mockSmtpService.sendEmail!).mockResolvedValue({
        success: true,
        message: "Email sent",
      });

      await handleEmailTool(
        "send_email",
        {
          to: [{ address: "pv@wibank.de" }],
          subject: "Re: Test",
          text: "Hallo",
          inReplyTo: "reply-123@wibank.de",
          references: ["<request-1@wibank.de>", "reply-123@wibank.de"],
        },
        mockEmailService as EmailService,
        mockSmtpService as SmtpService,
      );

      const sent = vi.mocked(mockSmtpService.sendEmail!).mock.calls[0][0];
      expect(sent.inReplyTo).toBe("<reply-123@wibank.de>");
      expect(sent.references).toEqual([
        "<request-1@wibank.de>",
        "<reply-123@wibank.de>",
      ]);
    });

    it("send_email should reject malformed Message-IDs", async () => {
      const result = await handleEmailTool(
        "send_email",
        {
          to: [{ address: "pv@wibank.de" }],
          subject: "Re: Test",
          text: "Hallo",
          inReplyTo: "not a message id",
        },
        mockEmailService as EmailService,
        mockSmtpService as SmtpService,
      );

      expect(result.isError).toBe(true);
      expect(mockSmtpService.sendEmail).not.toHaveBeenCalled();
    });

    it("reply_to_email should save a threaded draft by default", async () => {
      vi.mocked(mockEmailService.getEmail!).mockResolvedValue(original);
      vi.mocked(mockEmailService.createDraft!).mockResolvedValue({
        success: true,
        message: "Draft saved",
        uid: 42,
      });

      const result = await handleEmailTool(
        "reply_to_email",
        { uid: 15120, text: "Danke!" },
        mockEmailService as EmailService,
        mockSmtpService as SmtpService,
      );

      expect(mockSmtpService.sendEmail).not.toHaveBeenCalled();
      const [draft, folder] = vi.mocked(mockEmailService.createDraft!).mock
        .calls[0];
      expect(folder).toBe("Drafts");
      expect(draft.to).toEqual([
        { name: "PV-Anlagen-Darlehen", address: "pv@wibank.de" },
      ]);
      expect(draft.cc).toBeUndefined();
      expect(draft.subject).toBe("AW: Nachricht an die WIBank");
      expect(draft.inReplyTo).toBe("<reply-123@wibank.de>");
      expect(draft.references).toEqual([
        "<request-1@wibank.de>",
        "<reply-123@wibank.de>",
      ]);
      expect(draft.text).toBe("Danke!");
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain("saved as draft");
      expect(result.content[0].text).toContain(
        "In-Reply-To:** <reply-123@wibank.de>",
      );
    });

    it("reply_to_email should send, reply-all and store the Sent copy", async () => {
      vi.mocked(mockEmailService.getEmail!).mockResolvedValue(original);
      vi.mocked(mockSmtpService.sendEmail!).mockResolvedValue({
        success: true,
        message: "Email sent",
      });

      const result = await handleEmailTool(
        "reply_to_email",
        {
          uid: 15120,
          text: "Danke!",
          html: "<p>Danke!</p>",
          mode: "send",
          replyAll: true,
          from: { address: "alias+wibank@mailbox.org" },
          quoteOriginal: true,
        },
        mockEmailService as EmailService,
        mockSmtpService as SmtpService,
      );

      const sent = vi.mocked(mockSmtpService.sendEmail!).mock.calls[0][0];
      expect(sent.from).toEqual({ address: "alias+wibank@mailbox.org" });
      expect(sent.to).toEqual([
        { name: "PV-Anlagen-Darlehen", address: "pv@wibank.de" },
      ]);
      expect(sent.cc).toEqual([
        { name: "Kollege", address: "kollege@wibank.de" },
      ]);
      expect(sent.text).toContain("> Sehr geehrter Herr Born,");
      expect(sent.html).toContain("<blockquote");
      expect(mockEmailService.appendToSent).toHaveBeenCalledWith(sent);
      expect(result.content[0].text).toContain("Reply sent");
    });

    it("reply_to_email should hint at the alias when no from is given", async () => {
      vi.mocked(mockEmailService.getEmail!).mockResolvedValue({
        ...original,
        to: [{ address: "alias+wibank@mailbox.org" }],
      });
      vi.mocked(mockEmailService.createDraft!).mockResolvedValue({
        success: true,
        message: "Draft saved",
      });

      const result = await handleEmailTool(
        "reply_to_email",
        { uid: 15120, text: "Danke!" },
        mockEmailService as EmailService,
        mockSmtpService as SmtpService,
      );

      expect(result.content[0].text).toContain("alias+wibank@mailbox.org");
      expect(result.content[0].text).toContain('pass "from"');
    });

    it("reply_to_email should report a missing original", async () => {
      vi.mocked(mockEmailService.getEmail!).mockResolvedValue(null);

      const result = await handleEmailTool(
        "reply_to_email",
        { uid: 999, text: "Danke!" },
        mockEmailService as EmailService,
        mockSmtpService as SmtpService,
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("reply_to_email should refuse send mode without SMTP", async () => {
      const result = await handleEmailTool(
        "reply_to_email",
        { uid: 15120, text: "Danke!", mode: "send" },
        mockEmailService as EmailService,
      );

      expect(result.isError).toBe(true);
      expect(mockEmailService.getEmail).not.toHaveBeenCalled();
    });

    it("get_email should show threading headers", async () => {
      vi.mocked(mockEmailService.getEmail!).mockResolvedValue({
        ...original,
        replyTo: [{ address: "team@wibank.de" }],
      });

      const result = await handleEmailTool(
        "get_email",
        { uid: 15120 },
        mockEmailService as EmailService,
      );

      const text = result.content[0].text;
      expect(text).toContain("**From:** PV-Anlagen-Darlehen <pv@wibank.de>");
      expect(text).toContain("**Reply-To:** <team@wibank.de>");
      expect(text).toContain("**Message-ID:** <reply-123@wibank.de>");
      expect(text).toContain("**In-Reply-To:** <request-1@wibank.de>");
      expect(text).toContain("**References:** <request-1@wibank.de>");
    });
  });
});
