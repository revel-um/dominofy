// src/utils/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const ALGORITHM = 'aes-256-ctr';
const IV_LENGTH = 16;

export async function encryptPassword(password: string): Promise<string> {
  const iv = randomBytes(IV_LENGTH);
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY is not set in environment variables');
  }

  const key = (await scryptAsync(encryptionKey, 'salt', 32)) as Buffer;
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encryptedText = Buffer.concat([cipher.update(password), cipher.final()]);

  return `${iv.toString('hex')}:${encryptedText.toString('hex')}`;
}

export async function decryptPassword(encryptedPassword: string): Promise<string> {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY is not set in environment variables');
  }

  const [ivHex, encryptedHex] = encryptedPassword.split(':');

  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted password format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  const key = (await scryptAsync(encryptionKey, 'salt', 32)) as Buffer;

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  const decryptedText = Buffer.concat([decipher.update(encryptedText), decipher.final()]);

  return decryptedText.toString();
}
