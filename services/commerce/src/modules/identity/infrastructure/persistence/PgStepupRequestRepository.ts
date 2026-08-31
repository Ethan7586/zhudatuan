import type { OperationId } from '@shop/contract';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { ActionProofBinding, AuthorizedActionProof } from '../../../access/public';
import type { StepupRequestRepository } from '../../application/port/StepupRequestRepository';

interface StepupRequestRow {
  readonly operation_id: OperationId;
  readonly resource_id: string;
  readonly request_hash: string;
  readonly expected_version: number | null;
  readonly maker_membership_id: string;
}

export class PgStepupRequestRepository implements StepupRequestRepository {
  async save(database: OperationDatabase, challenge: string, approval: AuthorizedActionProof): Promise<void> {
    const { binding, checker } = approval;
    const result = await database.query(
      `insert into identity.stepuprequest(challenge_id,operation_id,resource_id,request_hash,expected_version,
      maker_membership_id,checker_membership_id,target,scope_id,checker_access_version,created_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,clock_timestamp()) on conflict(challenge_id) do nothing returning challenge_id`,
      [challenge, binding.operation, binding.resource, binding.requestHash, binding.expectedVersion, binding.makerMembership, checker.membership, checker.target, approval.scope, checker.accessVersion]
    );
    if (!result.rows[0]) throw new Error('STEPUP_ACTION_BINDING_CONFLICT');
  }

  async consume(database: OperationDatabase, challenge: string, checkerMembership: string): Promise<ActionProofBinding | null> {
    const result = await database.query<StepupRequestRow>(
      `update identity.stepuprequest set consumed_at=clock_timestamp()
      where challenge_id=$1 and checker_membership_id=$2 and consumed_at is null
      returning operation_id,resource_id,request_hash,expected_version,maker_membership_id`,
      [challenge, checkerMembership]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ operation: row.operation_id, resource: row.resource_id, requestHash: row.request_hash, expectedVersion: row.expected_version, makerMembership: row.maker_membership_id }) : null;
  }
}
