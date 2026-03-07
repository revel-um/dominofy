import { createHash } from 'crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function fingerprintBank(accountNumber: string, ifsc: string, name?: string): string {
  const normalized = `${accountNumber.trim()}|${ifsc.trim().toUpperCase()}|${(name || '').trim().toLowerCase()}`;
  return sha256(normalized);
}

export function fingerprintUpi(vpa: string, name?: string): string {
  const normalized = `${vpa.trim().toLowerCase()}|${(name || '').trim().toLowerCase()}`;
  return sha256(normalized);
}

export function maskString(value: string, keepLast = 4): string {
  if (!value) return value;
  const clean = value.trim();
  if (clean.length <= keepLast) return '*'.repeat(clean.length);
  return `${'*'.repeat(clean.length - keepLast)}${clean.slice(-keepLast)}`;
}

export function maskProviderResponse(raw: Record<string, any> | undefined) {
  if (!raw) return raw;
  const clone = JSON.parse(JSON.stringify(raw));
  const maskKeys = new Set(['account_number', 'vpa', 'upi', 'ifsc', 'account', 'bank_account']);

  const walk = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach((key) => {
      const val = obj[key];
      if (typeof val === 'object') {
        walk(val);
      } else if (typeof val === 'string' && maskKeys.has(key.toLowerCase())) {
        obj[key] = maskString(val);
      }
    });
  };

  walk(clone);
  return clone;
}

export function computeIdempotencyKey(seed: string): string {
  return sha256(seed);
}

export function deriveBatchStatus(statuses: string[]) {
  const processed = statuses.filter((s) => s === 'processed').length;
  const failed = statuses.filter((s) => s === 'failed' || s === 'reversed').length;
  const queued = statuses.filter((s) => s === 'queued').length;

  if (processed === statuses.length) return 'success';
  if (processed === 0 && failed === statuses.length) return 'failed';
  if (processed > 0 && failed > 0 && processed + failed === statuses.length) return 'partial';
  if (queued === statuses.length) return 'queued';
  return 'processing';
}

export function assertUpiCapability(upiSupported: boolean) {
  if (!upiSupported) {
    throw new Error('CAPABILITY_NOT_SUPPORTED');
  }
}

export function isTerminalPayoutStatus(status: string) {
  return status === 'processed' || status === 'failed' || status === 'reversed';
}
