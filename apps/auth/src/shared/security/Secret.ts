export class Secret {
  #value = '';

  set(value: string): void {
    this.clear();
    this.#value = value;
  }
  read(): string {
    return this.#value;
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

export function clearSecretInput(input: HTMLInputElement | null, secret: Secret): void {
  secret.clear();
  if (input !== null) input.value = '';
}
