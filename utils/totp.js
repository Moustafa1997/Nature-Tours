// time based one time passwords (RFC 6238) for two-factor authentication
// works with Google Authenticator, Authy, 1Password ...
const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30; // seconds
const DIGITS = 6;

const base32Encode = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i += 1) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
};

const base32Decode = (input) => {
  const clean = input.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (let i = 0; i < clean.length; i += 1) {
    const idx = ALPHABET.indexOf(clean[i]);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

// new random secret, base32 encoded (what authenticator apps expect)
const generateSecret = () => base32Encode(crypto.randomBytes(20));

// HOTP value for a given counter (RFC 4226)
const hotp = (key, counter, digits = DIGITS) => {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % 10 ** digits).padStart(digits, '0');
};

const currentStep = (time = Date.now()) => Math.floor(time / 1000 / STEP);

const generateToken = (secret, time = Date.now()) =>
  hotp(base32Decode(secret), currentStep(time));

// returns the matched time step (to block replays) or null
// window = number of 30s steps accepted before/after now (clock drift)
const verifyToken = (secret, token, { time = Date.now(), window = 1 } = {}) => {
  if (typeof token !== 'string' && typeof token !== 'number') return null;
  const code = String(token).replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32Decode(secret);
  const step = currentStep(time);
  for (let i = -window; i <= window; i += 1) {
    const expected = hotp(key, step + i);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return step + i;
    }
  }
  return null;
};

const otpauthURL = (secret, account, issuer = 'Natours') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
    account,
  )}?secret=${secret}&issuer=${encodeURIComponent(
    issuer,
  )}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;

module.exports = {
  base32Encode,
  base32Decode,
  generateSecret,
  hotp,
  generateToken,
  verifyToken,
  otpauthURL,
};
