import 'server-only';
import { getNorthConfig } from './config';

// The ONLY file that talks to checkout.north.com. One place where the private
// key leaves the process, one place to fix if North changes a header or field.

const NORTH_BASE_URL = 'https://checkout.north.com';

// North's integration guide says the User-Agent must contain "Embedded Checkout".
// Node's default fetch User-Agent does not, so set it explicitly.
const USER_AGENT = 'north-skills-starter/0.1 (Embedded Checkout; Next.js)';

const REQUEST_TIMEOUT_MS = 10_000;

export class NorthApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = 'NorthApiError';
  }
}

function northHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const { checkoutPrivateKey } = getNorthConfig();
  return {
    Authorization: `Bearer ${checkoutPrivateKey}`,
    'Content-Type': 'application/json',
    'Accept-Language': 'en',
    'User-Agent': USER_AGENT,
    ...extra,
  };
}

/** A line item as North expects it. `price` is the UNIT price in DOLLARS. */
export interface NorthProduct {
  name: string;
  price: number;
  quantity: number;
  logoUrl?: string;
}

/**
 * POST /api/sessions - create a checkout session.
 * The token is valid for 30 minutes and covers ONE payment attempt.
 */
export async function createSession(input: {
  /** Order total in integer cents. Converted to dollars only here. */
  amountCents: number;
  products?: NorthProduct[];
}): Promise<{ token: string }> {
  const { checkoutId, profileId } = getNorthConfig();
  const res = await fetch(`${NORTH_BASE_URL}/api/sessions`, {
    method: 'POST',
    headers: northHeaders(),
    body: JSON.stringify({
      checkoutId,
      profileId,
      // Must equal the products total when products are sent.
      amount: input.amountCents / 100,
      ...(input.products ? { products: input.products } : {}),
    }),
    // A fresh signal per call: a fired AbortSignal cannot be reused on a retry.
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const data = await parseJsonSafely(res);
  if (!res.ok) throw new NorthApiError(`North create session failed with HTTP ${res.status}`, res.status, data);

  const token = (data as { token?: unknown } | null)?.token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new NorthApiError('North create session response had no token', res.status, data);
  }
  return { token };
}

export type SessionStatus = 'Open' | 'Verified' | 'Approved' | 'Declined';
const SESSION_STATUSES: readonly string[] = ['Open', 'Verified', 'Approved', 'Declined'];

/**
 * GET /api/sessions/status - ask North what actually happened.
 * Server-only: it needs the private key, and North rejects requests that carry
 * an Origin header, so a browser cannot call it even by accident.
 * The browser's onPaymentComplete is a UI hint. This call is the truth.
 */
export async function getSessionStatus(token: string): Promise<{ status: SessionStatus; body: unknown }> {
  const { checkoutId, profileId } = getNorthConfig();
  const res = await fetch(`${NORTH_BASE_URL}/api/sessions/status`, {
    method: 'GET',
    headers: northHeaders({
      SessionToken: token,
      checkoutId,
      // The docs list only checkoutId; North's official sample also sends ProfileId.
      ProfileId: profileId,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const data = await parseJsonSafely(res);
  if (!res.ok) throw new NorthApiError(`North session status failed with HTTP ${res.status}`, res.status, data);

  const status = (data as { status?: unknown } | null)?.status;
  if (typeof status !== 'string' || !SESSION_STATUSES.includes(status)) {
    // Fail loudly rather than quietly treating an unknown answer as "unpaid".
    throw new NorthApiError('North session status had an unexpected status', res.status, data);
  }
  return { status: status as SessionStatus, body: (data as { body?: unknown }).body };
}

/** Keep non-JSON error text so logs still show what North said. */
async function parseJsonSafely(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}
