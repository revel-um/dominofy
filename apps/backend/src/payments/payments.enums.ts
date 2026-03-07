export enum PaymentProviderName {
  RAZORPAY = 'razorpay',
}

export enum PayerKycStatus {
  NOT_STARTED = 'not_started',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum PayerOnboardingStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum PaymentInstrumentType {
  BANK = 'bank',
  UPI = 'upi',
}

export enum PayoutMode {
  IMPS = 'imps',
  NEFT = 'neft',
  RTGS = 'rtgs',
  UPI = 'upi',
}

export enum PayoutStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  SUBMITTED = 'submitted',
  PROCESSED = 'processed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

export enum PayoutBatchStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

export enum PayoutPurpose {
  REFUND = 'refund',
  CASHBACK = 'cashback',
  SALARY = 'salary',
  UTILITY_BILL = 'utility_bill',
  VENDOR_PAYMENT = 'vendor_payment',
  OTHER = 'other',
}
