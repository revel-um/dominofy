// src/utils/encryption.ts
import { createCipheriv, createDecipheriv, DecipherGCM, randomBytes, scrypt } from 'crypto';
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

const ALGORITHM_GCM   = 'aes-256-gcm';
const IV_LENGTH_GCM   = 12;   // recommended for GCM
const TAG_LENGTH  = 16;   // auth tag length
const createKey = async () => {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY is not set in environment variables');
  }

  // assume hex-encoded 32-byte key
  const key = (await scryptAsync(encryptionKey, 'salt', 32)) as Buffer;
  return key;
}

/**
 * AES-256-GCM encrypt → base64
 */
export async function encrypt(plain: string) {
  const iv     = randomBytes(IV_LENGTH_GCM);
  const KEY    = await createKey();
  const cipher = createCipheriv(ALGORITHM_GCM, KEY, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // [ IV | TAG | CIPHERTEXT ]
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/**
 * base64 → AES-256-GCM decrypt → utf8
 */
export async function decrypt(blob: string) {
  const data = Buffer.from(blob, 'base64');

  const iv         = data.slice(0, IV_LENGTH_GCM);
  const tag        = data.slice(IV_LENGTH_GCM, IV_LENGTH_GCM + TAG_LENGTH);
  const ciphertext = data.slice(IV_LENGTH_GCM + TAG_LENGTH);

  // 1️⃣ Use the GCM algorithm constant here:
  //    not ALGORITHM ('aes-256-ctr'), but ALGORITHM_GCM ('aes-256-gcm')
  const KEY = await createKey();
  const decipher = createDecipheriv(ALGORITHM_GCM, KEY, iv) as DecipherGCM;

  // 2️⃣ Now TS knows this is a GCM decipher and has setAuthTag()
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plain.toString('utf8');
}
