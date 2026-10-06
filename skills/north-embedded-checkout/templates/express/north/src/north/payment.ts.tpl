// Pure helpers: no secrets, no I/O. Safe to unit test.

export interface PaymentFields {
  authGuid?: string;
  authCode?: string;
  authResp?: string;
  last4?: string;
  /** Approved amount in cents, from the processor's auth_amount (dollars). */
  amountCents?: number;
}

/** Pull what we need from a raw processor response (status receipt `body` or webhook `fullResponse`). */
export function paymentFields(raw: unknown): PaymentFields {
  const fr = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof fr[k] === 'string' && fr[k] ? (fr[k] as string) : undefined);
  const amount = Number(fr['auth_amount']);
  return {
    authGuid: str('auth_guid'),
    authCode: str('auth_code'),
    authResp: str('auth_resp'),
    last4: str('auth_masked_account_nbr')?.slice(-4),
    ...(fr['auth_amount'] !== undefined && Number.isFinite(amount) && amount >= 0
      ? { amountCents: Math.round(amount * 100) }
      : {}),
  };
}

/**
 * "Approved" alone is not enough to ship an order. A partial approval comes back
 * Approved with a non-"00" auth_resp and a smaller auth_amount. Paid means:
 * status Approved, auth_resp "00" when present, and the approved amount equals
 * what we charged when present.
 */
export function isPaidInFull(
  status: string,
  fields: PaymentFields,
  expectedAmountCents: number
): { paid: true } | { paid: false; reason: string } {
  if (status !== 'Approved') return { paid: false, reason: `status_${status || 'unknown'}` };
  if (fields.authResp !== undefined && fields.authResp !== '00') {
    return { paid: false, reason: `auth_resp_${fields.authResp}` };
  }
  if (fields.amountCents !== undefined && fields.amountCents !== expectedAmountCents) {
    return { paid: false, reason: 'amount_mismatch' };
  }
  return { paid: true };
}
