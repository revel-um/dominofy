import * as jwt from 'jsonwebtoken';

const fallback = (value: string | undefined, defaultValue: string) =>
  value && value.trim().length ? value : defaultValue;

export function generateJwtToken(payload: object, secret: string, expiresIn = '1d'): string {
  return jwt.sign(payload, secret, { expiresIn });
}

export function generateAccessToken(payload: object, secret: string, rawTtl?: string): string {
  // Allow overriding TTL via env; default to 24h for compatibility
  const expiresIn = fallback(rawTtl, '24h');
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyJwtToken(token: string, secret: string): any {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}
