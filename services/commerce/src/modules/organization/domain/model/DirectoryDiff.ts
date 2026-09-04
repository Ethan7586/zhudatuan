export type DirectoryApplyKind = 'create' | 'update' | 'freeze' | 'restore' | 'conflict';
export interface DirectoryCounts {
  readonly read: number;
  readonly applied: number;
  readonly creates: number;
  readonly updates: number;
  readonly freezes: number;
  readonly restores: number;
  readonly conflicts: number;
  readonly ignored: number;
}

export class DirectoryDiff implements DirectoryCounts {
  readonly read: number;
  readonly applied: number;
  readonly creates: number;
  readonly updates: number;
  readonly freezes: number;
  readonly restores: number;
  readonly conflicts: number;
  readonly ignored: number;

  constructor(actions: readonly (DirectoryApplyKind | 'noop')[]) {
    const count = (action: DirectoryApplyKind | 'noop') => actions.filter((candidate) => candidate === action).length;
    this.read = actions.length;
    this.creates = count('create');
    this.updates = count('update');
    this.freezes = count('freeze');
    this.restores = count('restore');
    this.conflicts = count('conflict');
    this.ignored = count('noop');
    this.applied = this.creates + this.updates + this.freezes + this.restores;
    if (this.applied + this.conflicts + this.ignored !== this.read) throw new Error('DIRECTORY_DIFF_INVALID');
    Object.freeze(this);
  }
}
