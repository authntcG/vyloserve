import { describe, it, expect } from 'vitest';
import {
  decodeJwt,
  base64UrlDecode,
  inspectJwtTimestamps,
  verifyJwtHmac,
  formatRelativeTime,
} from '../src/utils/jwtDebugger';

describe('jwtDebugger utility', () => {
  // Sample valid token:
  // header: {"alg":"HS256","typ":"JWT"} -> eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
  // payload: {"sub":"1234567890","name":"John Doe","iat":1516239022} -> eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ
  // signature with secret "your-256-bit-secret": SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
  const sampleToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  it('decodes base64url correctly', () => {
    const raw = 'eyJzdWIiOiIxMjM0NTY3ODkwIn0';
    const decoded = base64UrlDecode(raw);
    expect(decoded).toBe('{"sub":"1234567890"}');
  });

  it('decodes a valid JWT token into header, payload, and signature', () => {
    const res = decodeJwt(sampleToken);
    expect(res.isValid).toBe(true);
    expect(res.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(res.payload.name).toBe('John Doe');
    expect(res.payload.sub).toBe('1234567890');
    expect(res.signature).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
    expect(res.timestamps?.iat?.timestamp).toBe(1516239022);
  });

  it('handles invalid or empty tokens', () => {
    expect(decodeJwt('').isValid).toBe(false);
    expect(decodeJwt('single-part').isValid).toBe(false);
    expect(decodeJwt('invalid.base64!!.token').isValid).toBe(false);
  });

  it('inspects exp and calculates expiration correctly', () => {
    const nowSec = 1700000000;
    const nowMs = nowSec * 1000;

    // expired 1000 seconds ago
    const payloadExpired = { exp: nowSec - 1000, iat: nowSec - 2000 };
    const resExpired = inspectJwtTimestamps(payloadExpired, nowMs);
    expect(resExpired?.exp?.isExpired).toBe(true);

    // active for 1000 seconds
    const payloadActive = { exp: nowSec + 1000, iat: nowSec };
    const resActive = inspectJwtTimestamps(payloadActive, nowMs);
    expect(resActive?.exp?.isExpired).toBe(false);
  });

  it('formats relative time strings accurately', () => {
    expect(formatRelativeTime(-10)).toBe('10 secs ago');
    expect(formatRelativeTime(-120)).toBe('2 mins ago');
    expect(formatRelativeTime(3600)).toBe('in 1 hour');
    expect(formatRelativeTime(86400 * 2)).toBe('in 2 days');
  });

  it('verifies HMAC signature locally using Web Crypto API', async () => {
    const secret = 'your-256-bit-secret';
    const verifySuccess = await verifyJwtHmac(sampleToken, secret);
    expect(verifySuccess.isValid).toBe(true);

    const verifyWrongSecret = await verifyJwtHmac(sampleToken, 'wrong-secret');
    expect(verifyWrongSecret.isValid).toBe(false);
    expect(verifyWrongSecret.error).toContain('failed');
  });
});
