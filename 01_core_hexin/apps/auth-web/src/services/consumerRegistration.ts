const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function automaticL6DisplayName(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  return `L6消费者${digits.slice(-4)}`;
}

export function automaticRegistrationPassword(): string {
  const entropy = new Uint8Array(18);
  crypto.getRandomValues(entropy);
  const middle = Array.from(entropy, (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join('');
  return `A7-${middle}z`;
}
