import * as jwt from 'jsonwebtoken';

export function generateJwtToken(payload: object, secret: string, expiresIn='1d'): string {
    return jwt.sign(payload, secret, { expiresIn });
}