import { createHash } from 'node:crypto';
import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, keysetResult, queryPage } from '../../../../foundation/interface/Validation';
import type { RepairRepository } from '../../domain/repository/RepairRepository';
import type { RepairPolicy } from '../../domain/policy/RepairPolicy';
import type { Clock } from '../../../../foundation/domain/Clock';
import { financeEntries, positive, text } from './ManageFinancePolicy';
import { DomainError } from '../../../../foundation/domain/DomainError';

export function repairOperations(
  dependencies: Readonly<{
    scopes(database: OperationDatabase, scopeId: string): Promise<readonly string[]>;
    repository(database: OperationDatabase): RepairRepository;
    policy: RepairPolicy;
    clock: Clock;
  }>
): OperationActions {
  return {
    'finance.reconciliationrepairs.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await dependencies.repository(database).read(await dependencies.scopes(database, access.scope.id), query(request.input.query.status), query(request.input.query.statementId), page.id, page.fetch);
      return keysetResult(result, page, 'id');
    },
    'finance.reconciliationrepairs.preview': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const statementId = text(body.statementId, 'statementId');
      const sourceHash = hash(body.sourceHash, 'sourceHash');
      const sourceVersion = positive(body.expectedVersion, 'expectedVersion');
      const entries = financeEntries(body.entries);
      const reason = text(body.reason, 'reason');
      const repository = dependencies.repository(database);
      const statement = await repository.statement(access.scope.id, statementId);
      if (!statement) throw new DomainError('FINANCE_REPAIR_CONFLICT');
      if (statement.hash !== sourceHash) throw new DomainError('FINANCE_REPAIR_HASH_MISMATCH');
      if (statement.version !== sourceVersion) throw new DomainError('VERSION_CONFLICT');
      const source = { scopeId: access.scope.id, statementId, sourceHash, sourceVersion, entries, differences: statement.differences, makerId: access.actor.id, reason } as const;
      const preview = dependencies.policy.preview(source, dependencies.clock.now());
      if (!preview.balanced) throw new DomainError('FINANCE_JOURNAL_UNBALANCED');
      await repository.savePreview({ tokenHash: digest(preview.previewToken), ...source, previewHash: preview.previewHash, expiresAt: preview.expiresAt });
      const now = dependencies.clock.now().toISOString();
      const repair = {
        id: `reconciliationrepair:${digest(preview.previewHash)}`,
        statementId,
        status: 'draft',
        sourceHash,
        previewHash: preview.previewHash,
        differences: statement.differences,
        entries,
        makerId: access.actor.id,
        checkerId: null,
        reason,
        version: sourceVersion,
        createdAt: now,
        updatedAt: now,
      } as const;
      return { status: 200, body: { repair, ...preview } };
    },
    'finance.reconciliationrepairs.submit': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const previewToken = text(body.previewToken, 'previewToken');
      const previewHash = hash(body.previewHash, 'previewHash');
      const sourceVersion = positive(body.expectedVersion, 'expectedVersion');
      const reason = text(body.reason, 'reason');
      const claims = dependencies.policy.verify(previewToken, { scopeId: access.scope.id, previewHash, makerId: access.actor.id }, dependencies.clock.now());
      if (claims.sourceVersion !== sourceVersion) throw new DomainError('VERSION_CONFLICT');
      const id = `reconciliationrepair:${digest(`${claims.statementId}:${previewHash}`)}`;
      const result = await dependencies.repository(database).submit({ id, tokenHash: digest(previewToken), scopeId: access.scope.id, makerId: access.actor.id, previewHash, sourceVersion, reason });
      if (!result.rows[0]) throw new DomainError('FINANCE_REPAIR_CONFLICT');
      return rowResult(result, 201);
    },
    'finance.reconciliationrepairs.decide': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const decision = body.decision === 'approve' ? 'approved' : body.decision === 'reject' ? 'rejected' : null;
      if (!decision) throw new DomainError('VALIDATION_FAILED', { field: 'decision' });
      const result = await dependencies
        .repository(database)
        .decide({ id: request.input.path.repairid!, scopeId: access.scope.id, checkerId: access.actor.id, decision, expectedVersion: positive(body.expectedVersion, 'expectedVersion'), reason: text(body.reason, 'reason') });
      if (!result.rows[0]) throw new DomainError('FINANCE_REPAIR_CONFLICT');
      return rowResult(result);
    },
    'finance.reconciliationrepairs.reverse': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const result = await dependencies
        .repository(database)
        .reverse({ id: request.input.path.repairid!, scopeId: access.scope.id, checkerId: access.actor.id, expectedVersion: positive(body.expectedVersion, 'expectedVersion'), reason: text(body.reason, 'reason') });
      if (!result.rows[0]) throw new DomainError('FINANCE_REPAIR_CONFLICT');
      return rowResult(result);
    },
  };
}

function query(value: string | readonly string[] | undefined): string | null {
  const result = (Array.isArray(value) ? value[0] : value)?.trim();
  return result || null;
}

function hash(value: unknown, field: string): string {
  const result = text(value, field);
  if (!/^[a-f0-9]{64}$/.test(result)) throw new DomainError('VALIDATION_FAILED', { field });
  return result;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
