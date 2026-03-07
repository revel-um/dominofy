import {
  assertUpiCapability,
  computeIdempotencyKey,
  deriveBatchStatus,
  isTerminalPayoutStatus,
} from './payments.utils';

describe('payments utils', () => {
  it('computes deterministic idempotency key', () => {
    const key1 = computeIdempotencyKey('tenant|payer|run|step|corr');
    const key2 = computeIdempotencyKey('tenant|payer|run|step|corr');
    expect(key1).toEqual(key2);
  });

  it('derives batch status from payout statuses', () => {
    expect(deriveBatchStatus(['processed', 'processed'])).toEqual('success');
    expect(deriveBatchStatus(['failed', 'failed'])).toEqual('failed');
    expect(deriveBatchStatus(['processed', 'failed'])).toEqual('partial');
    expect(deriveBatchStatus(['queued', 'queued'])).toEqual('queued');
    expect(deriveBatchStatus(['processing', 'submitted'])).toEqual('processing');
  });

  it('gates UPI capability when unsupported', () => {
    expect(() => assertUpiCapability(false)).toThrow('CAPABILITY_NOT_SUPPORTED');
  });

  it('treats terminal statuses as idempotent webhook updates', () => {
    expect(isTerminalPayoutStatus('processed')).toBe(true);
    expect(isTerminalPayoutStatus('failed')).toBe(true);
    expect(isTerminalPayoutStatus('reversed')).toBe(true);
    expect(isTerminalPayoutStatus('processing')).toBe(false);
  });
});
