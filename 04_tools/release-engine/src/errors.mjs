export class DeliveryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DeliveryError';
    this.code = code;
    this.details = details;
  }
}

export function invariant(condition, code, message, details = {}) {
  if (!condition) throw new DeliveryError(code, message, details);
}

export function asDeliveryError(error) {
  if (error instanceof DeliveryError) return error;
  return new DeliveryError('DELIVERY_UNEXPECTED', error instanceof Error ? error.message : String(error), {
    cause: error instanceof Error ? error.stack : undefined,
  });
}
