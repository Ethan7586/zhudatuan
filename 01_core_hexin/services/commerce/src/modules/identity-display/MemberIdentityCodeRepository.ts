import { allocateMemberSuffixes, allocateStorefrontSegment, formatMemberIdentityCode } from './MemberIdentityCode';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

interface AssignedMemberCode {
  readonly membership_id: string;
  readonly suffix: string;
  readonly code: `MB-${string}`;
}

/** Allocates one global ST segment and batch-local MB suffixes; never changes a prior assignment. */
export async function assignMemberIdentityCodes(
  database: OperationDatabase,
  contextId: string,
  membershipIds: readonly string[],
): Promise<ReadonlyMap<string, `MB-${string}`>> {
  if (membershipIds.length === 0) return new Map();
  const uniqueIds = [...new Set(membershipIds)].sort();
  const node = await database.query<{ id: string }>(`select id from organization.node
    where mall_id=$1 and node_profile='operating_mall' and status='active' order by id limit 2`, [contextId]);
  if (node.rows.length !== 1) return new Map();
  const nodeId = node.rows[0]!.id;
  const prefix = await storeSegment(database, contextId, nodeId);
  const stored = new Map<string, AssignedMemberCode>();
  const reserved = new Set<string>();

  for (;;) {
    const rows = await database.query<AssignedMemberCode>(`select membership_id,suffix,code
      from identity_display.member_code_mapping where context_id=$1 and membership_id=any($2::text[])`,
    [contextId, uniqueIds]);
    for (const row of rows.rows) stored.set(row.membership_id, row);
    const missing = uniqueIds.filter((id) => !stored.has(id));
    if (missing.length === 0) break;
    const suffixes = allocateMemberSuffixes(nodeId, missing, new Map(), reserved);
    const requested = missing.map((id) => suffixes.get(id)!);
    await database.query(`insert into identity_display.member_code_mapping(context_id,membership_id,suffix,code)
      select $1,membership_id,suffix,code from unnest($2::text[],$3::text[],$4::text[]) candidate(membership_id,suffix,code)
      on conflict do nothing`,
    [contextId, missing, requested, requested.map((suffix) => formatMemberIdentityCode(prefix, suffix))]);
    const collided = await database.query<{ suffix: string }>(`select suffix from identity_display.member_code_mapping
      where context_id=$1 and suffix=any($2::text[]) and not (membership_id=any($3::text[]))`,
    [contextId, requested, missing]);
    for (const row of collided.rows) reserved.add(row.suffix);
    if (collided.rows.length === 0) {
      const persisted = await database.query<{ membership_id: string; context_id: string }>(`select membership_id,context_id
        from identity_display.member_code_mapping where membership_id=any($1::text[])`, [missing]);
      if (persisted.rows.some((row) => row.context_id !== contextId)) throw new Error('MB_CODE_MAPPING_CONFLICT');
    }
  }
  return new Map([...stored].map(([id, row]) => [id, row.code]));
}

export async function memberIdentityRepositoryAvailable(database: OperationDatabase): Promise<boolean> {
  const result = await database.query<{ segment: string | null; mapping: string | null }>(
    `select to_regclass('identity_display.member_store_segment')::text segment,
      to_regclass('identity_display.member_code_mapping')::text mapping`,
  );
  return result.rows[0]?.segment === 'identity_display.member_store_segment'
    && result.rows[0]?.mapping === 'identity_display.member_code_mapping';
}

async function storeSegment(database: OperationDatabase, contextId: string, nodeId: string): Promise<string> {
  const stored = await database.query<{ storefront_node_id: string; segment: string }>(`select storefront_node_id,segment
    from identity_display.member_store_segment where context_id=$1`, [contextId]);
  if (stored.rows[0]) {
    if (stored.rows[0].storefront_node_id !== nodeId) throw new Error('MB_CODE_STOREFRONT_CHANGED');
    return stored.rows[0].segment;
  }
  const collided = new Set<string>();
  for (;;) {
    const segment = allocateStorefrontSegment(nodeId, null, collided);
    const inserted = await database.query<{ segment: string }>(`insert into identity_display.member_store_segment(
      context_id,storefront_node_id,segment) values($1,$2,$3) on conflict do nothing returning segment`,
    [contextId, nodeId, segment]);
    if (inserted.rows[0]) return inserted.rows[0].segment;
    const concurrent = await database.query<{ storefront_node_id: string; segment: string }>(`select storefront_node_id,segment
      from identity_display.member_store_segment where context_id=$1`, [contextId]);
    if (concurrent.rows[0]) {
      if (concurrent.rows[0].storefront_node_id !== nodeId) throw new Error('MB_CODE_STOREFRONT_CHANGED');
      return concurrent.rows[0].segment;
    }
    collided.add(segment);
  }
}
