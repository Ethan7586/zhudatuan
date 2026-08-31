export class SecretState {
  #value = '';

  set(value: string): void {
    this.#value = value;
  }
  take(): string {
    const value = this.#value;
    this.clear();
    return value;
  }
  clear(): void {
    this.#value = '';
  }
}

export function clearSecretInput(input: HTMLInputElement | null, secret: SecretState): void {
  secret.clear();
  if (input !== null) input.value = '';
}
