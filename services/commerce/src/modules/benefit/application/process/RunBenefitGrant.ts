import type { BenefitJobProcess } from '../port/BenefitJobProcess';

export class RunBenefitGrant {
  constructor(private readonly process: BenefitJobProcess) {}

  execute(kind: 'benefitgrant' | 'benefitrevoke', scope: string, batch: string, signal: AbortSignal, deadline: number): Promise<void> {
    return kind === 'benefitgrant' ? this.process.grant(scope, batch, signal, deadline) : this.process.revoke(scope, batch, signal, deadline);
  }

  expire(signal: AbortSignal, deadline: number): Promise<void> {
    return this.process.expire(signal, deadline);
  }
}
