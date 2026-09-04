export interface BootstrapSection<T> {
  readonly state: 'complete' | 'unavailable' | 'failed';
  readonly version: string;
  readonly asOf: string;
  readonly data: T | null;
}

export class BootstrapMapper {
  section<T>(data: T, version: string | number, asOf = new Date().toISOString()): BootstrapSection<T> {
    return Object.freeze({ state: 'complete', version: String(version), asOf, data });
  }

  unavailable<T>(asOf = new Date().toISOString()): BootstrapSection<T> {
    return Object.freeze({ state: 'unavailable', version: '0', asOf, data: null });
  }

  failed<T>(asOf = new Date().toISOString()): BootstrapSection<T> {
    return Object.freeze({ state: 'failed', version: '0', asOf, data: null });
  }

  result(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    return Object.freeze({ ...input });
  }
}
