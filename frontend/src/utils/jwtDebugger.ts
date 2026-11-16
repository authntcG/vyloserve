export interface JwtTimestampClaim {
  timestamp: number; // in seconds
  formatted: string;
  diffText: string;
  isExpired?: boolean;
  isFuture?: boolean;
}

export interface DecodedJwtResult {
  isValid: boolean;
  error?: string;
  header?: any;
  payload?: any;
  signature?: string;
  rawHeader?: string;
  rawPayload?: string;
  timestamps?: {
    exp?: JwtTimestampClaim;
    iat?: JwtTimestampClaim;
    nbf?: JwtTimestampClaim;
  };
}

export type HmacAlgorithm = 'HS256' | 'HS384' | 'HS512';

/**
 * Decodes a Base64Url string to a UTF-8 string.
 */
export function base64UrlDecode(input: string): string {
  let base64 = input.replaceAll('-', '+').replaceAll('_', '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.codePointAt(i) ?? 0;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Converts Base64Url string to Uint8Array.
 */
export function base64UrlToBytes(input: string): Uint8Array {
  let base64 = input.replaceAll('-', '+').replaceAll('_', '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.codePointAt(i) ?? 0;
  }
  return bytes;
}

/**
 * Formats a relative time string (e.g., "in 15 minutes", "2 hours ago").
 */
export function formatRelativeTime(secondsDiff: number): string {
  const abs = Math.abs(secondsDiff);
  const isPast = secondsDiff < 0;

  let unit = '';
  let count = 0;

  if (abs < 60) {
    unit = 'sec';
    count = Math.floor(abs);
  } else if (abs < 3600) {
    unit = 'min';
    count = Math.floor(abs / 60);
  } else if (abs < 86400) {
    unit = 'hour';
    count = Math.floor(abs / 3600);
  } else {
    unit = 'day';
    count = Math.floor(abs / 86400);
  }

  const s = count > 1 ? 's' : '';
  if (isPast) {
    return `${count} ${unit}${s} ago`;
  }
  return `in ${count} ${unit}${s}`;
}

/**
 * Inspects exp, iat, and nbf timestamps from a JWT payload.
 */
export function inspectJwtTimestamps(
  payload: any,
  nowMs: number = Date.now()
): DecodedJwtResult['timestamps'] {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const nowSec = Math.floor(nowMs / 1000);
  const result: DecodedJwtResult['timestamps'] = {};

  if (typeof payload.exp === 'number') {
    const expSec = payload.exp;
    const diffSec = expSec - nowSec;
    const date = new Date(expSec * 1000);
    result.exp = {
      timestamp: expSec,
      formatted: date.toLocaleString(),
      diffText: formatRelativeTime(diffSec),
      isExpired: diffSec <= 0,
    };
  }

  if (typeof payload.iat === 'number') {
    const iatSec = payload.iat;
    const diffSec = iatSec - nowSec;
    const date = new Date(iatSec * 1000);
    result.iat = {
      timestamp: iatSec,
      formatted: date.toLocaleString(),
      diffText: formatRelativeTime(diffSec),
    };
  }

  if (typeof payload.nbf === 'number') {
    const nbfSec = payload.nbf;
    const diffSec = nbfSec - nowSec;
    const date = new Date(nbfSec * 1000);
    result.nbf = {
      timestamp: nbfSec,
      formatted: date.toLocaleString(),
      diffText: formatRelativeTime(diffSec),
      isFuture: diffSec > 0,
    };
  }

  return result;
}

/**
 * Decodes a raw JWT string into header, payload, and signature without network calls.
 */
export function decodeJwt(token: string, nowMs: number = Date.now()): DecodedJwtResult {
  if (!token?.trim()) {
    return { isValid: false, error: 'Empty JWT token' };
  }

  const trimmed = token.trim();
  const parts = trimmed.split('.');

  if (parts.length < 2) {
    return { isValid: false, error: 'JWT must contain at least Header and Payload separated by dot' };
  }

  let header: any;
  let payload: any;
  let rawHeader = '';
  let rawPayload = '';

  try {
    rawHeader = base64UrlDecode(parts[0]);
    header = JSON.parse(rawHeader);
  } catch (err: any) {
    return { isValid: false, error: `Invalid JWT Header Base64/JSON: ${err?.message || ''}` };
  }

  try {
    rawPayload = base64UrlDecode(parts[1]);
    payload = JSON.parse(rawPayload);
  } catch (err: any) {
    return { isValid: false, error: `Invalid JWT Payload Base64/JSON: ${err?.message || ''}` };
  }

  const signature = parts[2] || '';
  const timestamps = inspectJwtTimestamps(payload, nowMs);

  return {
    isValid: true,
    header,
    payload,
    signature,
    rawHeader,
    rawPayload,
    timestamps,
  };
}

/**
 * Verifies a JWT signature using Web Crypto HMAC (HS256, HS384, HS512) 100% locally.
 */
export async function verifyJwtHmac(
  token: string,
  secret: string,
  algoOverride?: HmacAlgorithm
): Promise<{ isValid: boolean; error?: string }> {
  if (!token?.trim()) {
    return { isValid: false, error: 'Token is empty' };
  }
  if (!secret) {
    return { isValid: false, error: 'Secret key is empty' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return { isValid: false, error: 'Token must have exactly 3 parts (header.payload.signature)' };
  }

  const decoded = decodeJwt(token);
  if (!decoded.isValid) {
    return { isValid: false, error: decoded.error };
  }

  const headerAlg = (decoded.header?.alg || '').toUpperCase();
  const selectedAlg = algoOverride || (headerAlg as HmacAlgorithm);

  const hashMap: Record<HmacAlgorithm, string> = {
    HS256: 'SHA-256',
    HS384: 'SHA-384',
    HS512: 'SHA-512',
  };

  const hashName = hashMap[selectedAlg];
  if (!hashName) {
    return {
      isValid: false,
      error: `Unsupported algorithm: '${selectedAlg}'. Only HS256, HS384, and HS512 are supported for HMAC verification.`,
    };
  }

  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
      return { isValid: false, error: 'Web Crypto API (subtle) is not available in this environment' };
    }

    const key = await subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: { name: hashName } },
      false,
      ['verify']
    );

    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signatureBytes = base64UrlToBytes(parts[2]);

    const isMatch = await subtle.verify(
      'HMAC',
      key,
      signatureBytes.buffer as ArrayBuffer,
      data.buffer as ArrayBuffer
    );
    if (!isMatch) {
      return { isValid: false, error: 'Signature verification failed (Secret or signature mismatch)' };
    }

    return { isValid: true };
  } catch (err: any) {
    return { isValid: false, error: err?.message || 'Verification error' };
  }
}
