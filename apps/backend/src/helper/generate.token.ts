import * as jwt from 'jsonwebtoken';

export function generateJwtToken(payload: object, secret: string, expiresIn='1d'): string {
    return jwt.sign(payload, secret, { expiresIn });
}

export function generateAccessToken(payload: object, secret: string): string {
    // Short-lived access token (24 hours as you mentioned)
    return jwt.sign(payload, secret, { expiresIn: '24h' });
}

export function verifyJwtToken(token: string, secret: string): any {
    try {
        return jwt.verify(token, secret);
    } catch (error) {
        return null;
    }
}