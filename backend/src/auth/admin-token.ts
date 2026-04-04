/**
 * Ephemeral admin token system.
 *
 * On every server startup a new cryptographically-random token is generated
 * and printed to stdout. Any authenticated user can POST that token to
 * /api/auth/claim-admin to have the Admin role assigned to their account.
 *
 * The token is valid for the lifetime of the current server process only.
 * It is rotated on every restart.
 */

import { randomBytes } from 'crypto';

// Generate once per process lifetime
const ADMIN_TOKEN = randomBytes(24).toString('hex');

// Track whether the token has already been claimed (optional — remove if you
// want multiple users to be able to claim admin this way)
let claimed = false;

export function getAdminToken(): string {
  return ADMIN_TOKEN;
}

export function printAdminToken(): void {
  const border = '─'.repeat(68);
  console.log(`\n┌${border}┐`);
  console.log(`│${''.padStart(20)}  HARMONY ADMIN TOKEN  ${''.padStart(24)}│`);
  console.log(`├${border}┤`);
  console.log(`│  ${ADMIN_TOKEN}  │`);
  console.log(`├${border}┤`);
  console.log(`│  Use this token in Settings → Account → Claim Admin to grant    │`);
  console.log(`│  yourself administrator privileges. Rotates on every restart.   │`);
  console.log(`└${border}┘\n`);
}

/**
 * Validates the submitted token.
 * Returns true if valid, false otherwise.
 * After a successful claim the token is marked as used.
 */
export function validateAndClaimToken(submitted: string): 'ok' | 'invalid' | 'already_claimed' {
  if (claimed) return 'already_claimed';
  if (submitted !== ADMIN_TOKEN) return 'invalid';
  claimed = true;
  return 'ok';
}

/**
 * Reset the claimed state (useful for testing or if you want unlimited claims).
 */
export function resetClaimedState(): void {
  claimed = false;
}
