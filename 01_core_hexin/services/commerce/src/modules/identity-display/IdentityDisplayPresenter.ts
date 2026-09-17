import type { IdentityDisplayHint } from '@shop/contract';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { allocateIdentityCodes, identityCodeCandidate, type IdentityCode, type IdentityCodeKind } from './IdentityCode';
import { assignMemberIdentityCodes, memberIdentityRepositoryAvailable } from './MemberIdentityCodeRepository';

interface IdentityDisplaySource {
  readonly membershipId: string;
  readonly maskedMobile?: string | null;
}

interface StoredCode {
  readonly membership_id: string;
  readonly code: IdentityCode;
}

export async function presentIdentityDisplays(
  database: OperationDatabase,
  contextId: string,
  kind: IdentityCodeKind,
  sources: readonly IdentityDisplaySource[],
): Promise<ReadonlyMap<string, IdentityDisplayHint>> {
  if (sources.length === 0) return new Map();
  try {
    return await assignDisplays(database, contextId, kind, sources);
  } catch {
    return new Map();
  }
}

export async function resolveIdentityDisplayMembership(
  database: OperationDatabase,
  contextId: string,
  kind: IdentityCodeKind,
  code: string,
): Promise<string | undefined> {
  if (kind === 'member') {
    if (!/^MB-[0-9A-HJKMNP-Z]{8}$/i.test(code)) return undefined;
    try {
      if (!await memberIdentityRepositoryAvailable(database)) return undefined;
      const result = await database.query<{ readonly membership_id: string }>(`select membership_id
        from identity_display.member_code_mapping where context_id=$1 and code=$2`,
      [contextId, code.toUpperCase()]);
      return result.rows[0]?.membership_id;
    } catch {
      return undefined;
    }
  }
  if (!/^OP-[2-9A-HJKMNP-Z]{6}$/i.test(code)) return undefined;
  try {
    if (!await identityDisplayRepositoryAvailable(database)) return undefined;
    const result = await database.query<{ readonly membership_id: string }>(`select membership_id
      from identity_display.code_mapping where kind=$1 and code=$2`,
    [kind, code.toUpperCase()]);
    return result.rows[0]?.membership_id;
  } catch {
    return undefined;
  }
}

async function assignDisplays(
  database: OperationDatabase,
  contextId: string,
  kind: IdentityCodeKind,
  sources: readonly IdentityDisplaySource[],
): Promise<ReadonlyMap<string, IdentityDisplayHint>> {
  if (kind === 'member') {
    if (!await memberIdentityRepositoryAvailable(database)) return new Map();
    const codes = await assignMemberIdentityCodes(database, contextId, sources.map((source) => source.membershipId));
    return new Map(sources.flatMap((source): [string, IdentityDisplayHint][] => {
      const code = codes.get(source.membershipId);
      if (code === undefined) return [];
      const hint: IdentityDisplayHint = { kind: 'member', code, label: '会员身份',
        ...(source.maskedMobile == null ? {} : { maskedMobile: source.maskedMobile }) };
      return [[source.membershipId, hint]];
    }));
  }
  if (!await identityDisplayRepositoryAvailable(database)) return new Map();
  const membershipIds = [...new Set(sources.map(({ membershipId }) => membershipId))];
  const candidates = membershipIds.flatMap((membershipId) =>
    Array.from({ length: 64 }, (_, attempt) => identityCodeCandidate(contextId, kind, membershipId, attempt)));
  await database.query('select pg_advisory_xact_lock(hashtext($1))', ['identity-display:operator']);
  const stored = await database.query<StoredCode>(`select membership_id,code
    from identity_display.code_mapping
    where kind=$1 and (membership_id=any($2::text[]) or code=any($3::text[]))`,
  [kind, membershipIds, candidates]);
  const existing = new Map(stored.rows
    .filter(({ membership_id }) => membershipIds.includes(membership_id))
    .map(({ membership_id, code }) => [membership_id, code]));
  const assigned = allocateIdentityCodes(
    membershipIds,
    existing,
    new Set(stored.rows.map(({ code }) => code)),
    (membershipId, attempt) => identityCodeCandidate(contextId, kind, membershipId, attempt),
  );
  const missing = membershipIds.filter((membershipId) => !existing.has(membershipId));
  if (missing.length > 0) {
    await database.query(`insert into identity_display.code_mapping(context_id,kind,membership_id,code)
      select $1,$2,membership_id,code from unnest($3::text[],$4::text[]) assigned(membership_id,code)
      on conflict do nothing`, [contextId, kind, missing, missing.map((membershipId) => assigned.get(membershipId)!) ]);
  }
  const confirmed = await database.query<StoredCode>(`select membership_id,code
    from identity_display.code_mapping where kind=$1 and membership_id=any($2::text[])`, [kind, membershipIds]);
  const sourceById = new Map(sources.map((source) => [source.membershipId, source]));
  return new Map(confirmed.rows.map(({ membership_id: membershipId, code }) => {
    const mobile = sourceById.get(membershipId)?.maskedMobile;
    const hint: IdentityDisplayHint = { kind: 'operator', code, label: '管理身份',
      ...(mobile == null ? {} : { maskedMobile: mobile }) };
    return [membershipId, hint];
  }));
}

async function identityDisplayRepositoryAvailable(database: OperationDatabase): Promise<boolean> {
  const result = await database.query<{ readonly mapping: string | null }>(
    "select to_regclass('identity_display.code_mapping')::text mapping",
  );
  return result.rows[0]?.mapping === 'identity_display.code_mapping';
}
