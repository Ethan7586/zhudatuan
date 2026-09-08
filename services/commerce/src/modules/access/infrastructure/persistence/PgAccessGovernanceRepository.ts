import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { OwnershipRepository, OwnershipTransferView, OwnershipView } from '../../application/port/OwnershipRepository';
import { OwnershipTransfer } from '../../domain/model/OwnershipTransfer';
import { PgOwnershipReadRepository } from './PgOwnershipReadRepository';
import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { ownershipTransferModel, ownershipTransferView, recordOwnershipTimeline, type OwnershipTransferRow } from './OwnershipRecord';

export class PgAccessGovernanceRepository extends PgOwnershipReadRepository implements OwnershipRepository {
  async create(context: WriteTransactionContext, transfer: OwnershipTransfer, reason: string, actor: string, trace: string): Promise<OwnershipTransferView | null> {
    const database = this.transactions.database(context);
    if (transfer.sourceProof === null || transfer.state !== 'pending') return null;
    const proof = `ownershipproof:${randomUUID()}`;
    const result = await database.query(
      `with proof as (
        insert into access.ownershipproof(id,tenant_id,scope_id,transfer_id,stage,actor_membership_id,token_hash,consumed_at,created_at)
        values($1,current_setting('app.tenant_id'),$2,$3,'source',$4,decode($5,'hex'),clock_timestamp(),clock_timestamp()) returning id
      ) insert into access.ownershiptransfer(id,tenant_id,scope_id,role_id,source_membership_id,target_membership_id,
        former_owner_mode,former_owner_role_id,former_owner_role_version,ownership_version,target_access_version,source_proof_id,state,reason,version,
        cooling_until,expires_at,created_by,updated_by,created_at,updated_at)
      select $3,current_setting('app.tenant_id'),$2,$6,$4,$7,$8,$9,$10,$11,$12,proof.id,'pending',$13,$14,$15,$16,$17,$17,clock_timestamp(),clock_timestamp()
      from proof where not exists(select 1 from access.ownershiptransfer active where active.scope_id=$2
        and active.state='pending' and active.expires_at>clock_timestamp())
      returning id`,
      [
        proof,
        transfer.scope,
        transfer.id,
        transfer.sourceMembership,
        transfer.sourceProof,
        transfer.role,
        transfer.targetMembership,
        transfer.formerOwnerMode,
        transfer.formerOwnerRole,
        transfer.formerOwnerRoleVersion,
        transfer.ownershipVersion,
        transfer.targetAccessVersion,
        reason,
        transfer.version,
        transfer.coolingUntil,
        transfer.expiresAt,
        actor,
      ]
    );
    if (!result.rows[0]) return null;
    await recordOwnershipTimeline(database, transfer.id, transfer.scope, 'draft', 'pending', actor, reason, transfer.version);
    await new PgRuntimeWriter(database).schedule({
      id: `job:ownershipexpiry:${transfer.id}`,
      kind: 'ownershipexpiry',
      owner: 'access',
      scope: transfer.scope,
      payload: { transfer: transfer.id, scope: transfer.scope, traceId: trace },
      priority: 90,
      availableAt: transfer.expiresAt.toISOString(),
    });
    return ownershipTransferView(database, transfer.scope, transfer.id);
  }

  async lockTransfer(context: WriteTransactionContext, scope: string, transfer: string): Promise<OwnershipTransfer | null> {
    const result = await this.transactions.database(context).query<OwnershipTransferRow>(
      `select candidate.id,candidate.scope_id,candidate.role_id,candidate.source_membership_id,candidate.target_membership_id,
      candidate.former_owner_mode,candidate.former_owner_role_id,candidate.former_owner_role_version,candidate.ownership_version,candidate.target_access_version,
      encode(source.token_hash,'hex') source_proof_hash,encode(target.token_hash,'hex') target_proof_hash,
      encode(cancel.token_hash,'hex') cancel_proof_hash,
      candidate.state,candidate.version,candidate.cooling_until,candidate.expires_at
      from access.ownershiptransfer candidate
      left join access.ownershipproof source on source.id=candidate.source_proof_id
      left join access.ownershipproof target on target.id=candidate.target_proof_id
      left join access.ownershipproof cancel on cancel.id=candidate.cancel_proof_id
      where candidate.id=$1 and candidate.scope_id=$2 and access.scope_allowed(candidate.scope_id) for update of candidate`,
      [transfer, scope]
    );
    const row = result.rows[0];
    return row ? ownershipTransferModel(row) : null;
  }

  async accept(context: WriteTransactionContext, transfer: OwnershipTransfer, actor: string): Promise<Readonly<{ ownership: OwnershipView; transfer: OwnershipTransferView }> | null> {
    const database = this.transactions.database(context);
    if (transfer.targetProof === null || transfer.state !== 'accepted') return null;
    const proof = `ownershipproof:${randomUUID()}`;
    const previousVersion = transfer.version - 1;
    const inserted = await database.query(
      `with proof as (
        insert into access.ownershipproof(id,tenant_id,scope_id,transfer_id,stage,actor_membership_id,token_hash,consumed_at,created_at)
        values($1,current_setting('app.tenant_id'),$2,$3,'target',$4,decode($5,'hex'),clock_timestamp(),clock_timestamp()) returning id
      ) update access.ownershiptransfer changed set state='accepted',target_proof_id=proof.id,version=$6,
        accepted_at=clock_timestamp(),updated_by=$4,updated_at=clock_timestamp()
      from proof where changed.id=$3 and changed.scope_id=$2 and changed.state='pending' and changed.version=$7
        and changed.cooling_until<=clock_timestamp() and changed.expires_at>clock_timestamp()
        and changed.source_membership_id<>$4 and changed.target_membership_id=$4
      returning changed.id`,
      [proof, transfer.scope, transfer.id, actor, transfer.targetProof, transfer.version, previousVersion]
    );
    if (!inserted.rows[0]) return null;
    const expired = await database.query(
      `update access.membershiprole set expires_at=clock_timestamp()
      where membership_id=$1 and role_id=$2 and effective_at<=clock_timestamp()
        and (expires_at is null or expires_at>clock_timestamp()) returning membership_id`,
      [transfer.sourceMembership, transfer.role]
    );
    if (expired.rows.length !== 1) throw new Error('OWNER_ROLE_SOURCE_INVALID');
    if (transfer.formerOwnerMode === 'retain_admin' && transfer.formerOwnerRole !== null) {
      const retained = await database.query(
        `insert into access.membershiprole(membership_id,role_id,effective_at,delegated_by)
        select $1,id,clock_timestamp(),$3 from access.role
        where id=$2 and scope_id=$4 and status='active' and kind<>'owner' and version=$5
        returning membership_id`,
        [transfer.sourceMembership, transfer.formerOwnerRole, actor, transfer.scope, transfer.formerOwnerRoleVersion]
      );
      if (retained.rows.length !== 1) throw new Error('FORMER_OWNER_ROLE_VERSION_CONFLICT');
    }
    if (transfer.formerOwnerMode === 'remove_admin') {
      await database.query(
        `update access.membershiprole set expires_at=clock_timestamp()
        where membership_id=$1 and effective_at<=clock_timestamp()
          and (expires_at is null or expires_at>clock_timestamp())`,
        [transfer.sourceMembership]
      );
      await database.query(
        `update access.scopegrant set expires_at=clock_timestamp()
        where membership_id=$1 and scope_kind<>'self' and effective_at<=clock_timestamp()
          and (expires_at is null or expires_at>clock_timestamp())`,
        [transfer.sourceMembership]
      );
      await database.query(
        `update access.membershipoverride set revoked_at=clock_timestamp()
        where membership_id=$1 and revoked_at is null and effective_at<=clock_timestamp()
          and (expires_at is null or expires_at>clock_timestamp())`,
        [transfer.sourceMembership]
      );
    }
    await database.query(
      `insert into access.membershiprole(membership_id,role_id,effective_at,delegated_by)
      values($1,$2,clock_timestamp(),$3)`,
      [transfer.targetMembership, transfer.role, actor]
    );
    const owner = await database.query(
      `update access.ownership set membership_id=$2,version=version+1,updated_at=clock_timestamp()
      where scope_id=$1 and membership_id=$3 and version=$4 returning version`,
      [transfer.scope, transfer.targetMembership, transfer.sourceMembership, transfer.ownershipVersion]
    );
    if (!owner.rows[0]) throw new Error('OWNERSHIP_VERSION_CONFLICT');
    await database.query(
      `update access.membership set access_version=access_version+1,
      status=case when id=$2 and $3='remove_admin' then 'suspended' else status end
      where id=any($1::text[]) and status='active'`,
      [[transfer.sourceMembership, transfer.targetMembership], transfer.sourceMembership, transfer.formerOwnerMode]
    );
    await recordOwnershipTimeline(database, transfer.id, transfer.scope, 'pending', 'accepted', actor, 'targetaccepted', transfer.version);
    const view = await this.read(context, transfer.scope, actor);
    const changed = await ownershipTransferView(database, transfer.scope, transfer.id);
    return view && changed ? Object.freeze({ ownership: view, transfer: changed }) : null;
  }

  async cancel(context: WriteTransactionContext, transfer: OwnershipTransfer, reason: string, actor: string): Promise<OwnershipTransferView | null> {
    const database = this.transactions.database(context);
    if (transfer.state !== 'cancelled') return null;
    if (transfer.cancelProof === null) return null;
    const proof = `ownershipproof:${randomUUID()}`;
    const result = await database.query(
      `with proof as (
        insert into access.ownershipproof(id,tenant_id,scope_id,transfer_id,stage,actor_membership_id,token_hash,consumed_at,created_at)
        values($1,current_setting('app.tenant_id'),$2,$3,'cancel',$4,decode($5,'hex'),clock_timestamp(),clock_timestamp()) returning id
      ) update access.ownershiptransfer changed set state='cancelled',cancel_proof_id=proof.id,cancellation_reason=$6,
        version=$7,cancelled_at=clock_timestamp(),updated_by=$4,updated_at=clock_timestamp()
      from proof where changed.id=$3 and changed.scope_id=$2 and changed.state='pending' and changed.version=$8
        and changed.source_membership_id=$4 and changed.expires_at>clock_timestamp() returning changed.id`,
      [proof, transfer.scope, transfer.id, actor, transfer.cancelProof, reason, transfer.version, transfer.version - 1]
    );
    if (!result.rows[0]) return null;
    await recordOwnershipTimeline(database, transfer.id, transfer.scope, 'pending', 'cancelled', actor, reason, transfer.version);
    return ownershipTransferView(database, transfer.scope, transfer.id);
  }

  async expire(context: WriteTransactionContext, scope: string, transfer: string, trace: string): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await database.query<{ id: string; source_membership_id: string; target_membership_id: string; version: number }>(
      `update access.ownershiptransfer set state='expired',version=version+1,expired_at=clock_timestamp(),
      updated_by='job:ownershipexpiry',updated_at=clock_timestamp()
      where id=$1 and scope_id=$2 and state='pending' and expires_at<=clock_timestamp()
      returning id,source_membership_id,target_membership_id,version`,
      [transfer, scope]
    );
    const changed = result.rows[0];
    if (!changed) return false;
    await recordOwnershipTimeline(database, changed.id, scope, 'pending', 'expired', 'job:ownershipexpiry', 'acceptancetimeout', Number(changed.version));
    await new PgRuntimeWriter(database).append({
      id: `event:${randomUUID()}`,
      type: 'access.owner.transfer.expired',
      aggregateType: 'ownershiptransfer',
      aggregate: changed.id,
      scope,
      payload: { transfer: changed.id, scope, sourceMembership: changed.source_membership_id, targetMembership: changed.target_membership_id, version: Number(changed.version) },
      trace,
    });
    return true;
  }
}
