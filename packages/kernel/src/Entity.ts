export abstract class Entity<TId extends string = string> {
  protected constructor(readonly id: TId) {
    if (!id) throw new Error('ENTITY_ID_INVALID');
  }

  equals(other: Entity<TId> | undefined): boolean {
    return other !== undefined && this.constructor === other.constructor && this.id === other.id;
  }
}
