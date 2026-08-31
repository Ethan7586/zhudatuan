export type DirectoryDifferenceKind = 'create' | 'update' | 'freeze' | 'restore' | 'noop' | 'conflict';
export interface DirectoryDifference {
  readonly kind: DirectoryDifferenceKind;
  readonly subjecthash: Buffer;
  readonly membership: string | null;
  readonly organization: string;
  readonly status: 'active' | 'inactive' | 'conflict';
  readonly sourceversion: number;
  readonly explicitdeparture: boolean;
}
export class LifecyclePolicy {
  decide(
    current: Readonly<{ status: string; sourceversion: number; missingcount: number; membership: string | null }> | null,
    incoming: Readonly<{ status: 'active' | 'inactive' | 'conflict'; sourceversion: number; explicitdeparture: boolean }>
  ): DirectoryDifferenceKind {
    if (current && incoming.sourceversion < current.sourceversion) return 'noop';
    if (incoming.status === 'conflict') return 'conflict';
    if (!current) return incoming.status === 'active' ? 'create' : 'noop';
    if (incoming.status === 'inactive' && (incoming.explicitdeparture || current.missingcount >= 1)) return 'freeze';
    if (incoming.status === 'active' && current.status !== 'active') return 'restore';
    if (incoming.status === 'active' && current.sourceversion > 0 && incoming.sourceversion > current.sourceversion) return 'update';
    return 'noop';
  }
}
