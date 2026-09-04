export interface CredentialGenerateWork {
  generate(input: Readonly<{ job: string; pool: string; count: number; start: number; scope: string; signal: AbortSignal; deadline: number }>): Promise<void>;
}

export class CredentialGenerateProcess {
  constructor(private readonly work: CredentialGenerateWork) {}

  execute(job: string, pool: string, count: number, start: number, scope: string, signal: AbortSignal, deadline: number): Promise<void> {
    if (!job || !pool || !scope || !Number.isSafeInteger(count) || count <= 0 || !Number.isSafeInteger(start) || start <= 0) throw new Error('VOUCHER_GENERATE_PAYLOAD_INVALID');
    return this.work.generate(Object.freeze({ job, pool, count, start, scope, signal, deadline }));
  }
}
