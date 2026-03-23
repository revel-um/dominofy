import { createCipheriv, createDecipheriv, DecipherGCM, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const ALGORITHM = 'aes-256-ctr';
const IV_LENGTH = 16;
const ALGORITHM_GCM = 'aes-256-gcm';
const IV_LENGTH_GCM = 12;
const TAG_LENGTH = 16;

let hasWarnedAboutEncryptionFallback = false;

function resolveEncryptionSecrets(): string[] {
  const encryptionKey = process.env.ENCRYPTION_KEY?.trim();
  const jwtSecret = process.env.JWT_SECRET?.trim();
  const secrets = [encryptionKey, jwtSecret].filter(
    (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index
  );

  if (secrets.length) {
    if (!hasWarnedAboutEncryptionFallback && !encryptionKey && jwtSecret) {
      hasWarnedAboutEncryptionFallback = true;
      console.warn('ENCRYPTION_KEY is not set; falling back to JWT_SECRET for local encryption.');
    }

    return secrets;
  }

  throw new Error('ENCRYPTION_KEY or JWT_SECRET must be set in environment variables');
}

function resolvePrimaryEncryptionSecret(): string {
  return resolveEncryptionSecrets()[0];
}

async function deriveKey(secret: string): Promise<Buffer> {
  return (await scryptAsync(secret, 'salt', 32)) as Buffer;
}

export async function encryptPassword(password: string): Promise<string> {
  const iv = randomBytes(IV_LENGTH);
  const key = await deriveKey(resolvePrimaryEncryptionSecret());
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encryptedText = Buffer.concat([cipher.update(password), cipher.final()]);

  return `${iv.toString('hex')}:${encryptedText.toString('hex')}`;
}

export async function decryptPassword(encryptedPassword: string): Promise<string> {
  const [ivHex, encryptedHex] = encryptedPassword.split(':');

  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted password format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  let lastError: unknown;

  for (const secret of resolveEncryptionSecrets()) {
    try {
      const key = await deriveKey(secret);
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      const decryptedText = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
      return decryptedText.toString();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to decrypt password');
}

async function createKey() {
  return deriveKey(resolvePrimaryEncryptionSecret());
}

export async function encrypt(plain: string) {
  const iv = randomBytes(IV_LENGTH_GCM);
  const key = await createKey();
  const cipher = createCipheriv(ALGORITHM_GCM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export async function decrypt(blob: string) {
  const data = Buffer.from(blob, 'base64');
  const iv = data.slice(0, IV_LENGTH_GCM);
  const tag = data.slice(IV_LENGTH_GCM, IV_LENGTH_GCM + TAG_LENGTH);
  const ciphertext = data.slice(IV_LENGTH_GCM + TAG_LENGTH);
  let lastError: unknown;

  for (const secret of resolveEncryptionSecrets()) {
    try {
      const key = await deriveKey(secret);
      const decipher = createDecipheriv(ALGORITHM_GCM, key, iv) as DecipherGCM;
      decipher.setAuthTag(tag);

      const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return plain.toString('utf8');
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to decrypt payload');
}
