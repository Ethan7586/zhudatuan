import { signedLevelNumber, type SignedLevel } from './SignedLevel.ts';
import {
  assertRegistryIdentifierUnique,
  canonicalText,
  compareText,
  exactRecord,
  parseCanonicalTimestamp,
  parseLifecycleStatus,
  parseNodeProfile,
  parseNullableText,
  parseSignedLevel,
  requiredArray,
  type NodeLifecycleStatus,
  type NodeProfile,
} from './NodeParsing.ts';

export const SFL_NODE_TOPOLOGY_SCHEMA_VERSION = 'sfl.node-topology.v1' as const;
export type SovereigntyTier = 'sovereign' | 'hosted';

export interface NodeRecord {
  readonly line_id: string;
  readonly node_id: string;
  readonly sovereignty_tier: SovereigntyTier;
  readonly node_profile: NodeProfile;
  readonly realm_id: string;
  readonly mall_id: string | null;
  readonly status: NodeLifecycleStatus;
  readonly created_at: string;
}

export interface NodeRelationRecord {
  readonly line_id: string;
  readonly node_id: string;
  readonly parent_node_id: string | null;
  readonly original_parent_node_id: string | null;
  readonly signed_level: SignedLevel;
  readonly host_sovereign_node_id: string;
  readonly relation_version: number;
  readonly effective_at: string;
  readonly superseded_at: string | null;
}

export interface SflNodeTopology {
  readonly schema_version: typeof SFL_NODE_TOPOLOGY_SCHEMA_VERSION;
  readonly nodes: readonly NodeRecord[];
  readonly relations: readonly NodeRelationRecord[];
}

export interface ResolvedNodeRecord extends NodeRecord, NodeRelationRecord {}

export const NODE_RECORD_KEYS = ['line_id', 'node_id', 'sovereignty_tier', 'node_profile', 'realm_id', 'mall_id', 'status', 'created_at'] as const;
export const NODE_RELATION_KEYS = [
  'line_id',
  'node_id',
  'parent_node_id',
  'original_parent_node_id',
  'signed_level',
  'host_sovereign_node_id',
  'relation_version',
  'effective_at',
  'superseded_at',
] as const;
const NODE_TOPOLOGY_KEYS = ['schema_version', 'nodes', 'relations'] as const;

export function parseNodeRecord(value: unknown): NodeRecord {
  const record = exactRecord(value, NODE_RECORD_KEYS, 'SFL_NODE_RECORD_INVALID');
  const sovereigntyTier = canonicalText(record.sovereignty_tier, 'sovereignty_tier');
  if (sovereigntyTier !== 'sovereign' && sovereigntyTier !== 'hosted') {
    throw new Error('SFL_SOVEREIGNTY_TIER_INVALID');
  }
  const nodeProfile = parseNodeProfile(record.node_profile);
  if (nodeProfile === null) throw new Error('SFL_NODE_PROFILE_INVALID');
  const node: NodeRecord = {
    line_id: canonicalText(record.line_id, 'line_id'),
    node_id: canonicalText(record.node_id, 'node_id'),
    sovereignty_tier: sovereigntyTier,
    node_profile: nodeProfile,
    realm_id: canonicalText(record.realm_id, 'realm_id'),
    mall_id: parseNullableText(record.mall_id, 'mall_id'),
    status: parseLifecycleStatus(record.status),
    created_at: parseCanonicalTimestamp(record.created_at),
  };
  if (node.sovereignty_tier === 'sovereign' && node.node_profile !== 'operating_mall') {
    throw new Error(`SFL_SOVEREIGN_NODE_PROFILE_INVALID:${node.node_id}`);
  }
  if (node.node_profile === 'consumer' && node.mall_id !== null) {
    throw new Error(`SFL_CONSUMER_NODE_MALL_INVALID:${node.node_id}`);
  }
  return Object.freeze(node);
}

export function parseNodeRelationRecord(value: unknown): NodeRelationRecord {
  const record = exactRecord(value, NODE_RELATION_KEYS, 'SFL_NODE_RELATION_INVALID');
  const relationVersion = record.relation_version;
  if (!Number.isSafeInteger(relationVersion) || (relationVersion as number) < 1) {
    throw new Error('SFL_NODE_RELATION_VERSION_INVALID');
  }
  const effectiveAt = parseCanonicalTimestamp(record.effective_at);
  const supersededAt = record.superseded_at === null ? null : parseCanonicalTimestamp(record.superseded_at);
  if (supersededAt !== null && supersededAt <= effectiveAt) {
    throw new Error('SFL_NODE_RELATION_PERIOD_INVALID');
  }
  return Object.freeze({
    line_id: canonicalText(record.line_id, 'line_id'),
    node_id: canonicalText(record.node_id, 'node_id'),
    parent_node_id: parseNullableText(record.parent_node_id, 'parent_node_id'),
    original_parent_node_id: parseNullableText(record.original_parent_node_id, 'original_parent_node_id'),
    signed_level: parseSignedLevel(record.signed_level),
    host_sovereign_node_id: canonicalText(record.host_sovereign_node_id, 'host_sovereign_node_id'),
    relation_version: relationVersion as number,
    effective_at: effectiveAt,
    superseded_at: supersededAt,
  });
}

export function parseSflNodeTopology(value: unknown): SflNodeTopology {
  const record = exactRecord(value, NODE_TOPOLOGY_KEYS, 'SFL_NODE_TOPOLOGY_INVALID');
  if (record.schema_version !== SFL_NODE_TOPOLOGY_SCHEMA_VERSION) {
    throw new Error('SFL_NODE_TOPOLOGY_SCHEMA_VERSION_INVALID');
  }
  const topology: SflNodeTopology = {
    schema_version: SFL_NODE_TOPOLOGY_SCHEMA_VERSION,
    nodes: requiredArray(record.nodes, 'nodes').map(parseNodeRecord).sort(compareNodes),
    relations: requiredArray(record.relations, 'relations').map(parseNodeRelationRecord).sort(compareNodeRelations),
  };
  validateSflNodeTopology(topology);
  return Object.freeze(topology);
}

export function resolveNodeRecord(topology: SflNodeTopology, nodeId: string, at: string): ResolvedNodeRecord {
  const parsed = parseSflNodeTopology(topology);
  const node = parsed.nodes.find((candidate) => candidate.node_id === nodeId);
  if (node === undefined) throw new Error(`SFL_NODE_UNKNOWN:${nodeId}`);
  const instant = parseCanonicalTimestamp(at);
  const matches = parsed.relations.filter((relation) => relation.node_id === nodeId
    && relation.effective_at <= instant
    && (relation.superseded_at === null || instant < relation.superseded_at));
  if (matches.length !== 1) throw new Error(`SFL_NODE_RELATION_NOT_UNIQUE:${nodeId}:${instant}`);
  return Object.freeze({ ...node, ...matches[0]! });
}

function validateSflNodeTopology(topology: SflNodeTopology): void {
  assertRegistryIdentifierUnique(topology.nodes.map((node) => node.node_id), 'node_id');
  assertRegistryIdentifierUnique(topology.nodes.map((node) => node.realm_id), 'realm_id');
  const nodes = new Map(topology.nodes.map((node) => [node.node_id, node]));
  const grouped = new Map<string, NodeRelationRecord[]>();
  for (const relation of topology.relations) {
    const node = nodes.get(relation.node_id);
    if (node === undefined || node.line_id !== relation.line_id) {
      throw new Error(`SFL_NODE_RELATION_NODE_INVALID:${relation.node_id}`);
    }
    for (const reference of [relation.parent_node_id, relation.original_parent_node_id]) {
      if (reference !== null && nodes.get(reference)?.line_id !== relation.line_id) {
        throw new Error(`SFL_NODE_RELATION_PARENT_INVALID:${relation.node_id}`);
      }
    }
    const host = nodes.get(relation.host_sovereign_node_id);
    if (host === undefined || host.line_id !== relation.line_id || host.sovereignty_tier !== 'sovereign') {
      throw new Error(`SFL_NODE_RELATION_HOST_INVALID:${relation.node_id}`);
    }
    if (node.sovereignty_tier === 'sovereign'
      ? relation.host_sovereign_node_id !== node.node_id
      : relation.host_sovereign_node_id === node.node_id) {
      throw new Error(`SFL_NODE_RELATION_SOVEREIGNTY_INVALID:${relation.node_id}`);
    }
    const level = signedLevelNumber(relation.signed_level);
    if (level === 0 ? relation.parent_node_id !== null : relation.parent_node_id === null) {
      throw new Error(`SFL_NODE_RELATION_PARENT_INVALID:${relation.node_id}`);
    }
    const key = `${relation.line_id}\u0000${relation.node_id}`;
    const history = grouped.get(key) ?? [];
    history.push(relation);
    grouped.set(key, history);
  }
  if (grouped.size !== topology.nodes.length) throw new Error('SFL_NODE_RELATION_MISSING');
  for (const history of grouped.values()) validateNodeRelationHistory(history, topology.relations);
}

function validateNodeRelationHistory(history: NodeRelationRecord[], relations: readonly NodeRelationRecord[]): void {
  history.sort(compareNodeRelations);
  const first = history[0]!;
  if (first.relation_version !== 1 || first.original_parent_node_id !== first.parent_node_id) {
    throw new Error(`SFL_NODE_RELATION_ORIGIN_INVALID:${first.node_id}`);
  }
  for (let index = 0; index < history.length; index += 1) {
    const relation = history[index]!;
    if (relation.relation_version !== index + 1 || relation.original_parent_node_id !== first.original_parent_node_id) {
      throw new Error(`SFL_NODE_RELATION_VERSION_SEQUENCE_INVALID:${relation.node_id}`);
    }
    const next = history[index + 1];
    if (next !== undefined && (relation.superseded_at === null || relation.superseded_at > next.effective_at)) {
      throw new Error(`SFL_NODE_RELATION_PERIOD_OVERLAP:${relation.node_id}`);
    }
    const level = signedLevelNumber(relation.signed_level);
    if (level <= 0) continue;
    const parent = relations.find((candidate) => candidate.node_id === relation.parent_node_id
      && candidate.line_id === relation.line_id
      && candidate.effective_at <= relation.effective_at
      && (candidate.superseded_at === null || relation.effective_at < candidate.superseded_at));
    if (parent === undefined) throw new Error(`SFL_NODE_RELATION_PARENT_INACTIVE:${relation.node_id}`);
    const parentLevel = signedLevelNumber(parent.signed_level);
    if ((level >= 7 && parentLevel !== level - 1) || (level === 6 && (parentLevel < 0 || parentLevel > 5))
      || (level >= 1 && level <= 5 && (parentLevel < 0 || parentLevel >= level))) {
      throw new Error(`SFL_NODE_RELATION_LEVEL_INVALID:${relation.node_id}`);
    }
  }
}

function compareNodes(left: NodeRecord, right: NodeRecord): number {
  return compareText(left.line_id, right.line_id) || compareText(left.node_id, right.node_id);
}

function compareNodeRelations(left: NodeRelationRecord, right: NodeRelationRecord): number {
  return compareText(left.line_id, right.line_id)
    || compareText(left.node_id, right.node_id)
    || left.relation_version - right.relation_version;
}
