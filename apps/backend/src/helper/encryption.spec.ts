import { encrypt, decrypt } from './encryption';

describe('encryption helpers', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-secret-key';
  });

  it('encrypts and decrypts payloads', async () => {
    const payload = JSON.stringify({ accountNumber: '1234567890', ifsc: 'TEST0001' });
    const encrypted = await encrypt(payload);
    const decrypted = await decrypt(encrypted);
    expect(decrypted).toEqual(payload);
  });
});
