import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getNorthConfig } from './config';

// Transaction webhook verification.
//   X-YourApp-Signature-256: HMAC-SHA256 keyed with the CHECKOUT PRIVATE KEY
//   X-YourApp-Timestamp:     Unix time in milliseconds
// Signed over the exact raw request bytes. Not the signup-webhook scheme
// (X-Webhook-Signature with a sec_ secret) - do not mix the two up.
//
// North must allowlist your webhook URL before it delivers. Set the BASE URL
// (e.g. https://your-host/api/webhooks/north) in Checkout Designer; North
// appends /transaction itself.

const MAX_SKEW_MS = 5 * 60 * 1000;

export type VerifyResult = { ok: true; scheme: 'body' | 'timestamp.body' } | { ok: false; reason: string };

function hmacHex(message: Buffer): string {
  return createHmac('sha256', getNorthConfig().checkoutPrivateKey).update(message).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * `rawBody` MUST be the bytes exactly as received. Parsing and re-stringifying
 * changes whitespace and key order, and the HMAC will never match.
 * The guide leaves two details open, so both are accepted (both are keyed HMACs,
 * so this does not weaken verification): an optional "sha256=" prefix, and a
 * signed string of either the body or "<timestamp>.<body>".
 */
export function verifySignature(rawBody: Buffer, headers: { get(name: string): string | null }): VerifyResult {
  const sig = headers.get('x-yourapp-signature-256');
  const ts = headers.get('x-yourapp-timestamp');
  if (!sig) return { ok: false, reason: 'missing signature header' };
  if (!ts) return { ok: false, reason: 'missing timestamp header' };

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: 'timestamp is not a number' };
  if (Math.abs(Date.now() - tsNum) > MAX_SKEW_MS) return { ok: false, reason: 'timestamp outside allowed window' };

  const provided = sig.trim().replace(/^sha256=/i, '').toLowerCase();
  if (safeEqualHex(provided, hmacHex(rawBody))) return { ok: true, scheme: 'body' };
  if (safeEqualHex(provided, hmacHex(Buffer.concat([Buffer.from(`${ts}.`), rawBody])))) {
    return { ok: true, scheme: 'timestamp.body' };
  }
  return { ok: false, reason: 'signature mismatch' };
}

export interface TransactionWebhook {
  transaction?: {
    tranType?: string;
    authResp?: string;
    /** Raw processor response, same shape as the status receipt. */
    fullResponse?: Record<string, unknown>;
  };
  sessionData?: { amount?: number };
}

/**
 * Idempotency key: a hash of the exact bytes. Retries of one event carry the
 * same bytes; a later event for the same transaction (e.g. a refund) does not,
 * so it is not mistaken for a duplicate the way an auth_guid key would be.
 */
export function dedupeKey(rawBody: Buffer): string {
  return createHash('sha256').update(rawBody).digest('hex');
}
