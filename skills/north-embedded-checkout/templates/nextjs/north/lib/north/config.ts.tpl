import 'server-only';

// The only file that reads process.env.NORTH_*. Everything else calls
// getNorthConfig(), so there is one place to audit which secrets the app holds.
//
// Reads are lazy: a missing variable throws (naming it) on first use, never at
// import, so `next build` still works before the checkout is configured.

export interface NorthConfig {
  /** Bearer token for server -> North calls, and the HMAC key for transaction webhooks. */
  checkoutPrivateKey: string;
  checkoutId: string;
  profileId: string;
}

const REQUIRED = {
  checkoutPrivateKey: 'NORTH_CHECKOUT_PRIVATE_KEY',
  checkoutId: 'NORTH_CHECKOUT_ID',
  profileId: 'NORTH_PROFILE_ID',
} as const;

function read(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function required(name: string): string {
  const value = read(name);
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. Add it to .env.local.`);
  }
  return value;
}

export function isNorthConfigured(): boolean {
  return Object.values(REQUIRED).every((name) => Boolean(read(name)));
}

export function getNorthConfig(): NorthConfig {
  return {
    checkoutPrivateKey: required(REQUIRED.checkoutPrivateKey),
    checkoutId: required(REQUIRED.checkoutId),
    profileId: required(REQUIRED.profileId),
  };
}
