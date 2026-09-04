import { type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { FinanceEntries } from './FinanceOperation';
import { createHash } from 'node:crypto';

import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { bodyRecord, keysetRows, queryPage } from '../../../../foundation/application/Validation';
import type { RepairRepository } from '../../application/port/RepairRepository';
import type { RepairPolicy } from '../../domain/policy/RepairPolicy';
import type { Clock } from '../../../../foundation/domain/Clock';
import { financeEntries, positive, text } from './PolicyActions';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';
import { executionRequestHash } from '../../../../foundation/application/OperationHash';
import type { RepairApproval } from '../../application/service/RepairApproval';
import { repairAmount } from '../../domain/model/RepairProposal';

export function repairOperations(
  dependencies: Readonly<{
    scopes(database: SqlExecutor, scopeId: string): Promise<readonly string[]>;
    repository(database: SqlExecutor): RepairRepository;
    policy: RepairPolicy;
    approval: RepairApproval;
    clock: Clock;
  }>
): FinanceEntries<'repairsRead' | 'repairsPreview' | 'repairsSubmit' | 'repairsDecide' | 'repairsReverse'> {
  return {
    repairsRead: async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const result = await dependencies.repository(database).read(await dependencies.scopes(database, access.scope.id), query(request.input.query.status), query(request.input.query.statementId), page.id, page.fetch);
      return keysetRows(result, page, 'id');
    },
    repairsPreview: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
      const statementId = text(body.statementId, 'statementId');
      const sourceJournalId = text(body.sourceJournalId, 'sourceJournalId');
      const sourceHash = hash(body.sourceHash, 'sourceHash');
      const sourceVersion = positive(body.expectedVersion, 'expectedVersion');
      const entries = financeEntries(body.entries);
      const reason = text(body.reason, 'reason');
      const repository = dependencies.repository(database);
      const statement = await repository.statement(access.scope.id, statementId);
      if (!statement) throw new DomainError('FINANCE_REPAIR_CONFLICT');
      if (statement.hash !== sourceHash) throw new DomainError('FINANCE_REPAIR_HASH_MISMATCH');
      if (statement.version !== sourceVersion) throw new DomainError('VERSION_CONFLICT');
      const sourceJournal = await repository.sourceJournal(access.scope.id, sourceJournalId, statement.periodStart, statement.periodEnd, statement.currency);
      if (!sourceJournal) throw new DomainError('FINANCE_REPAIR_CONFLICT');
      const source = {
        scopeId: access.scope.id,
        statementId,
        sourceHash,
        sourceVersion,
        sourceJournalId,
        sourceJournalHash: sourceJournal.hash,
        sourceJournalDebitMinor: sourceJournal.debitMinor,
        entries,
        differences: statement.differences,
        makerId: access.membership.id,
        reason,
      } as const;
      const preview = dependencies.policy.preview(source, dependencies.clock.now());
      if (!preview.balanced) throw new DomainError('FINANCE_JOURNAL_UNBALANCED');
      const now = dependencies.clock.now().toISOString();
      const repair = {
        id: `reconciliationrepair:${digest(preview.previewHash)}`,
        statementId,
        status: 'draft',
        sourceHash,
        sourceJournalId,
        sourceJournalHash: sourceJournal.hash,
        previewHash: preview.previewHash,
        differences: statement.differences,
        entries,
        makerId: access.membership.id,
        checkerId: null,
        approvalInstanceId: null,
        approvalAmountMinor: null,
        sourceReversalJournalId: null,
        replacementJournalId: null,
        rollbackJournalId: null,
        reason,
        decisionReason: null,
        reverseReason: null,
        reversedBy: null,
        decidedAt: null,
        reversedAt: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      } as const;
      return { status: 200, body: { repair, ...preview } };
    },
    repairsSubmit: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
      const previewToken = token(body.previewToken);
      const previewHash = hash(body.previewHash, 'previewHash');
      const sourceVersion = positive(body.expectedVersion, 'expectedVersion');
      const claims = dependencies.policy.verify(previewToken, { scopeId: access.scope.id, previewHash, makerId: access.membership.id }, dependencies.clock.now());
      if (claims.sourceVersion !== sourceVersion) throw new DomainError('VERSION_CONFLICT');
      const id = `reconciliationrepair:${digest(`${claims.statementId}:${previewHash}`)}`;
      const receipt = await dependencies.approval.request(requireWriteTransaction(request.transaction), id, previewHash, claims);
      const result = await dependencies.repository(database).submit({ id, previewHash, approvalInstanceId: receipt.instanceId, approvalAmountMinor: repairAmount(claims), proposal: claims });
      if (!result) throw new DomainError('FINANCE_REPAIR_CONFLICT');
      return recordResult(result, 201);
    },
    repairsDecide: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
      const decision = body.decision === 'approve' ? 'approved' : body.decision === 'reject' ? 'rejected' : null;
      if (!decision) throw new DomainError('VALIDATION_FAILED', { field: 'decision' });
      const expectedVersion = positive(body.expectedVersion, 'expectedVersion');
      const repository = dependencies.repository(database);
      const current = await repository.lock(request.input.path.repairid!, access.scope.id);
      if (current.status !== 'submitted') throw new DomainError('FINANCE_REPAIR_ALREADY_DECIDED');
      if (current.version !== expectedVersion) throw new DomainError('VERSION_CONFLICT');
      const proof = body.approvalProof === undefined ? null : text(body.approvalProof, 'approvalProof');
      const authorized = await dependencies.approval.authorize(
        requireWriteTransaction(request.transaction),
        current,
        decision,
        proof,
        executionRequestHash(request.type, { path: request.input.path, query: request.input.query, body: request.input.body }, request.input.expectedVersion)
      );
      const result = await repository.decide({ id: current.id, scopeId: current.scopeId, checkerId: authorized.checkerId, proofId: authorized.proofId, decision, expectedVersion, reason: text(body.reason, 'reason') });
      if (!result) throw new DomainError('FINANCE_REPAIR_CONFLICT');
      return recordResult(result);
    },
    repairsReverse: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
      const result = await dependencies
        .repository(database)
        .reverse({ id: request.input.path.repairid!, scopeId: access.scope.id, checkerId: access.membership.id, expectedVersion: positive(body.expectedVersion, 'expectedVersion'), reason: text(body.reason, 'reason') });
      if (!result) throw new DomainError('FINANCE_REPAIR_CONFLICT');
      return recordResult(result);
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

function token(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 131_072 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new DomainError('VALIDATION_FAILED', { field: 'previewToken' });
  }
  return value;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function recordResult(record: Readonly<Record<string, unknown>>, status = 200) {
  const version = Reflect.get(record, 'version');
  return { status, body: record, ...(version === undefined ? {} : { headers: { etag: `"${String(version)}"` } }) };
}
