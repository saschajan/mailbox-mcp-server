import { randomUUID } from "node:crypto";
import type { EmailMessage } from "../types/email.types.js";

type Address = { name?: string; address: string };

/** Max number of Message-IDs kept in a References header */
const MAX_REFERENCES = 20;

/** Reply prefixes used by common clients (en, de, nordic, it) */
const REPLY_PREFIX_PATTERN = /^\s*(re|aw|antw|sv|vs|r)\s*:/i;

export const normalizeMessageId = (id: string): string =>
  `<${id.trim().replace(/^<+/, "").replace(/>+$/, "")}>`;

export const generateMessageId = (domain = "mailbox.org"): string =>
  `<${randomUUID()}@${domain}>`;

export const domainOf = (address: string): string =>
  address.split("@")[1] || "mailbox.org";

/** Default sender: the login address with a display name derived from it */
export const defaultSender = (address: string): Address => ({
  name: address
    .split("@")[0]
    .split(/[._-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" "),
  address,
});

export const buildReplySubject = (subject: string): string => {
  const trimmed = subject.trim();
  if (REPLY_PREFIX_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return trimmed ? `Re: ${trimmed}` : "Re:";
};

/**
 * Build In-Reply-To and References per RFC 5322 section 3.6.4:
 * References = parent's References (or parent's In-Reply-To) + parent's Message-ID.
 */
export const buildReplyHeaders = (
  original: Pick<EmailMessage, "messageId" | "inReplyTo" | "references">,
): { inReplyTo?: string; references?: string[] } => {
  if (!original.messageId) {
    return {};
  }

  const parentId = normalizeMessageId(original.messageId);
  const ancestors =
    original.references && original.references.length > 0
      ? original.references
      : original.inReplyTo
        ? [original.inReplyTo]
        : [];

  const chain = [...ancestors.map(normalizeMessageId), parentId].filter(
    (id, index, all) => all.indexOf(id) === index,
  );

  // Keep the thread root and the most recent IDs when the chain is long
  const references =
    chain.length > MAX_REFERENCES
      ? [chain[0], ...chain.slice(-(MAX_REFERENCES - 1))]
      : chain;

  return { inReplyTo: parentId, references };
};

const isOwn = (address: string, ownAddresses: string[]): boolean =>
  ownAddresses.some(own => own.toLowerCase() === address.toLowerCase());

/**
 * Work out who a reply goes to. Reply-To wins over From. When the original
 * was sent by the user, the reply goes to the original recipients instead.
 * Reply-all adds the remaining recipients as CC, minus the user's own addresses.
 */
export const buildReplyRecipients = (
  original: Pick<EmailMessage, "from" | "to" | "cc" | "replyTo">,
  ownAddresses: string[],
  replyAll: boolean,
): { to: Address[]; cc: Address[] } => {
  const sentByMe = original.from.some(f => isOwn(f.address, ownAddresses));

  let to: Address[];
  if (original.replyTo && original.replyTo.length > 0) {
    to = original.replyTo;
  } else if (sentByMe) {
    to = original.to;
  } else {
    to = original.from;
  }

  if (!replyAll) {
    return { to, cc: [] };
  }

  const taken = new Set(to.map(a => a.address.toLowerCase()));
  const cc: Address[] = [];
  for (const candidate of [...original.to, ...(original.cc || [])]) {
    const key = candidate.address.toLowerCase();
    if (taken.has(key) || isOwn(candidate.address, ownAddresses)) {
      continue;
    }
    taken.add(key);
    cc.push(candidate);
  }

  return { to, cc };
};

const formatAddress = (addr: Address): string =>
  addr.name ? `${addr.name} <${addr.address}>` : addr.address;

const quoteHeader = (original: EmailMessage): string =>
  `On ${original.date.toISOString()}, ${original.from.map(formatAddress).join(", ")} wrote:`;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const buildQuotedText = (original: EmailMessage): string => {
  const body = (original.text || "").replace(/\r\n/g, "\n").trimEnd();
  const quoted = body
    .split("\n")
    .map(line => (line ? `> ${line}` : ">"))
    .join("\n");
  return `${quoteHeader(original)}\n${quoted}`;
};

export const buildQuotedHtml = (original: EmailMessage): string => {
  const body =
    original.html ||
    `<pre style="white-space:pre-wrap">${escapeHtml(original.text || "")}</pre>`;
  return `<p>${escapeHtml(quoteHeader(original))}</p><blockquote type="cite" style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${body}</blockquote>`;
};
