import crypto from 'crypto';

const HASH_ITERATIONS = 120_000;
const HASH_KEY_LENGTH = 64;
const HASH_DIGEST = 'sha512';

export function generatePasswordSalt() {
  return crypto.randomBytes(16).toString('hex');
}

export function hashPassword(password: string, salt: string) {
  return crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST).toString('hex');
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const computedHash = hashPassword(password, salt);
  const computed = Buffer.from(computedHash, 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  if (computed.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(computed, expected);
}
