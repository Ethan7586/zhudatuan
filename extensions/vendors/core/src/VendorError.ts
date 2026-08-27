export class VendorFailure extends Error {
  constructor(readonly code: string, readonly retryable: boolean, readonly status?: number, options?: ErrorOptions) {
    super(code, options);
    this.name = 'VendorFailure';
  }
}

export function asVendorFailure(error: unknown): VendorFailure {
  if (error instanceof VendorFailure) return error;
  if (error instanceof Error && error.message === 'DEADLINE_EXCEEDED') return new VendorFailure('VENDOR_DEADLINE_EXCEEDED', false, undefined, { cause: error });
  return new VendorFailure('VENDOR_TRANSPORT_FAILED', true, undefined, { cause: error });
}
