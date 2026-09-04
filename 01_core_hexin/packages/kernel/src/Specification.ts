export interface Specification<T> {
  satisfiedBy(candidate: T): boolean;
}

export class AndSpecification<T> implements Specification<T> {
  constructor(private readonly specifications: readonly Specification<T>[]) {
    if (specifications.length === 0) throw new Error('SPECIFICATION_EMPTY');
  }

  satisfiedBy(candidate: T): boolean {
    return this.specifications.every((specification) => specification.satisfiedBy(candidate));
  }
}

export class OrSpecification<T> implements Specification<T> {
  constructor(private readonly specifications: readonly Specification<T>[]) {
    if (specifications.length === 0) throw new Error('SPECIFICATION_EMPTY');
  }

  satisfiedBy(candidate: T): boolean {
    return this.specifications.some((specification) => specification.satisfiedBy(candidate));
  }
}
