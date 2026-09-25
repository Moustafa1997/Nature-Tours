const totp = require('../../utils/totp');

describe('totp', () => {
  // RFC 6238 test secret "12345678901234567890"
  const secret = totp.base32Encode(Buffer.from('12345678901234567890'));

  test('base32 encode / decode round trip', () => {
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(totp.base32Decode(secret).toString()).toBe('12345678901234567890');
  });

  test('matches the RFC 6238 test vectors (6 digits)', () => {
    // 8 digit vectors from the RFC, last 6 digits
    expect(totp.generateToken(secret, 59 * 1000)).toBe('287082');
    expect(totp.generateToken(secret, 1111111109 * 1000)).toBe('081804');
    expect(totp.generateToken(secret, 1234567890 * 1000)).toBe('005924');
    expect(totp.generateToken(secret, 2000000000 * 1000)).toBe('279037');
  });

  test('verifyToken accepts the current code and a small clock drift', () => {
    const s = totp.generateSecret();
    const now = Date.now();
    expect(totp.verifyToken(s, totp.generateToken(s, now), { time: now })).not.toBeNull();
    expect(
      totp.verifyToken(s, totp.generateToken(s, now - 30000), { time: now }),
    ).not.toBeNull();
    expect(
      totp.verifyToken(s, totp.generateToken(s, now - 120000), { time: now }),
    ).toBeNull();
  });

  test('verifyToken rejects bad input', () => {
    const s = totp.generateSecret();
    expect(totp.verifyToken(s, undefined)).toBeNull();
    expect(totp.verifyToken(s, { $gt: '' })).toBeNull();
    expect(totp.verifyToken(s, 'abcdef')).toBeNull();
    expect(totp.verifyToken(s, '12345')).toBeNull();
  });

  test('otpauth url', () => {
    expect(totp.otpauthURL('ABC', 'a@b.com')).toBe(
      'otpauth://totp/Natours:a%40b.com?secret=ABC&issuer=Natours&algorithm=SHA1&digits=6&period=30',
    );
  });
});
