import type { FinancePersistence } from './FinanceAction';
import { type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { createHash } from 'node:crypto';

import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { bodyRecord, keysetRows, queryPage } from '../../../../foundation/interface/Validation';
import type { FinanceEntryTemplate } from '../../domain/model/FinancePolicy';
import { FinancePolicy } from '../../domain/model/FinancePolicy';
import type { PolicyRepository } from '../../application/port/PolicyRepository';
import type { PolicyPreview } from '../../domain/policy/PolicyPreview';
import type { Clock } from '../../../../foundation/domain/Clock';
import { DomainError } from '../../../../foundation/domain/DomainError';

export function financePolicyOperations(
  dependencies: Readonly<{
    scopes(database: SqlExecutor, scopeId: string): Promise<readonly string[]>;
    repository(database: SqlExecutor): PolicyRepository;
    preview: PolicyPreview;
    clock: Clock;
  }>
): Pick<FinancePersistence, 'policiesRead' | 'policiesPreview'> {
  return {
    policiesRead: async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const scopes = await dependencies.scopes(database, access.scope.id);
      const status = query(request.input.query.status);
      const result = await dependencies.repository(database).read(scopes, status, page.id, page.fetch);
      return keysetRows(result, page, 'id');
    },
    policiesPreview: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
      const entries = financeEntries(body.entries);
      const version = positive(body.expectedVersion, 'expectedVersion');
      const policy = new FinancePolicy(
        `financepolicy:${digest(`${access.scope.id}:${text(body.name, 'name')}:${version}`)}`,
        text(body.name, 'name'),
        'draft',
        text(body.trigger, 'trigger'),
        entries,
        time(body.effectiveAt, 'effectiveAt'),
        body.expiresAt === undefined || body.expiresAt === null ? null : time(body.expiresAt, 'expiresAt'),
        version
      );
      const sampleFrom = time(body.sampleFrom, 'sampleFrom');
      const sampleTo = time(body.sampleTo, 'sampleTo');
      const scopes = await dependencies.scopes(database, access.scope.id);
      const affectedCount = await dependencies.repository(database).affected(scopes, sampleFrom, sampleTo);
      const preview = dependencies.preview.create(policy, { from: sampleFrom, to: sampleTo, affectedCount }, dependencies.clock.now());
      if (!preview.balanced) throw new DomainError('FINANCE_JOURNAL_UNBALANCED');
      return { status: 200, body: { policy, affectedCount, sampleEntries: entries, ...preview } };
    },
  };
}

export function financeEntries(value: unknown): readonly FinanceEntryTemplate[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new DomainError('VALIDATION_FAILED', { field: 'entries' });
  return Object.freeze(
    value.map((item) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) throw new DomainError('VALIDATION_FAILED', { field: 'entries' });
      const row = item as Record<string, unknown>;
      return Object.freeze({
        account: text(row.account, 'entries.account'),
        debitMinor: unsigned(row.debitMinor, 'entries.debitMinor'),
        creditMinor: unsigned(row.creditMinor, 'entries.creditMinor'),
        currency: text(row.currency, 'entries.currency'),
        memo: text(row.memo, 'entries.memo'),
      });
    })
  );
}

function query(value: string | readonly string[] | undefined): string | null {
  const result = (Array.isArray(value) ? value[0] : value)?.trim();
  return result || null;
}

export function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 1000) throw new DomainError('VALIDATION_FAILED', { field });
  return value.trim();
}

export function time(value: unknown, field: string): string {
  const result = text(value, field);
  if (Number.isNaN(Date.parse(result)) || !result.endsWith('Z')) throw new DomainError('VALIDATION_FAILED', { field });
  return result;
}

function unsigned(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new DomainError('VALIDATION_FAILED', { field });
  return value as number;
}

export function positive(value: unknown, field: string): number {
  const result = unsigned(value, field);
  if (result < 1) throw new DomainError('VALIDATION_FAILED', { field });
  return result;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
