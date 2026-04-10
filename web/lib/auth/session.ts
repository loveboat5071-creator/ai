type UserRole = 'sales' | 'admin' | 'miner';

interface SessionPayload {
  role: UserRole;
  exp: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const AUTH_COOKIE_NAME = 'wm_session';

function getSessionSecret(): string | null {
  return (
    process.env.AUTH_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.MINER_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    process.env.SALES_PASSWORD ||
    null
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return bytesToBase64Url(new Uint8Array(sig));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function issueSessionToken(role: UserRole, ttlSeconds = 60 * 60 * 12): Promise<string | null> {
  const secret = getSessionSecret();
  if (!secret) return null;

  const payload: SessionPayload = {
    role,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadB64 = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export async function verifySessionToken(token: string, role?: UserRole): Promise<SessionPayload | null> {
  const secret = getSessionSecret();
  if (!secret || !token) return null;

  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) return null;

  const expectedSig = await sign(payloadB64, secret);
  if (!safeEqual(signature, expectedSig)) return null;

  try {
    const payload = JSON.parse(decoder.decode(base64UrlToBytes(payloadB64))) as SessionPayload;
    if (!payload || typeof payload.exp !== 'number' || !payload.role) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (role && payload.role !== role) return null;
    return payload;
  } catch {
    return null;
  }
}
