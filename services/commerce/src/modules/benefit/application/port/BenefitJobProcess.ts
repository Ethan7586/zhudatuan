export interface BenefitJobProcess {
  grant(scope: string, batch: string, signal: AbortSignal, deadline: number): Promise<void>;
  revoke(scope: string, batch: string, signal: AbortSignal, deadline: number): Promise<void>;
  expire(signal: AbortSignal, deadline: number): Promise<void>;
}
