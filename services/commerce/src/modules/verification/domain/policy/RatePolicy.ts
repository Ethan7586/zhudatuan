import { DomainError } from '../../../../foundation/domain/DomainError';

export class RatePolicy {
  constructor(
    private readonly maximumIssuesPerMinute = 5,
    private readonly minimumIssueIntervalSeconds = 10
  ) {}

  issue(input: Readonly<{ count: number; lastIssuedAt: Date | null; now: Date }>): void {
    if (!Number.isSafeInteger(input.count) || input.count < 0) throw new DomainError('VALIDATION_FAILED');
    if (input.count >= this.maximumIssuesPerMinute) throw new DomainError('RATE_LIMITED');
    if (input.lastIssuedAt !== null && input.now.getTime() - input.lastIssuedAt.getTime() < this.minimumIssueIntervalSeconds * 1000) throw new DomainError('RATE_LIMITED');
  }

  verify(attempts: number, maximumAttempts: number): void {
    if (!Number.isSafeInteger(attempts) || !Number.isSafeInteger(maximumAttempts) || attempts < 0 || maximumAttempts < 1) throw new DomainError('VALIDATION_FAILED');
    if (attempts >= maximumAttempts) throw new DomainError('RATE_LIMITED');
  }
}
