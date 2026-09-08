import { DomainError } from '../../../../platform/error/DomainError';

export interface PostingReferenceValue {
  readonly module: string;
  readonly aggregate: string;
  readonly aggregateId: string;
  readonly event: string;
  readonly eventId: string;
  readonly leg: string;
}

export class PostingReference {
  private constructor(readonly value: PostingReferenceValue) {
    Object.freeze(this.value);
    Object.freeze(this);
  }

  static of(value: PostingReferenceValue): PostingReference {
    const module = identifier(value.module, 'module');
    const aggregate = identifier(value.aggregate, 'aggregate');
    const event = eventName(value.event);
    if (event.includes('.') && event.split('.')[0] !== module) {
      throw new DomainError('VALIDATION_FAILED', { field: 'event' });
    }
    return new PostingReference({
      module,
      aggregate,
      aggregateId: reference(value.aggregateId, 'aggregateId'),
      event,
      eventId: reference(value.eventId, 'eventId'),
      leg: reference(value.leg, 'leg'),
    });
  }

  get businessKey(): string {
    return `${this.value.module}:${this.value.aggregate}:${this.value.aggregateId}`;
  }

  equals(other: PostingReference): boolean {
    return this.businessKey === other.businessKey && this.value.event === other.value.event && this.value.eventId === other.value.eventId && this.value.leg === other.value.leg;
  }
}

function identifier(value: string, field: string): string {
  const result = value.trim();
  if (!/^[a-z][a-z0-9]{1,31}$/.test(result)) throw new DomainError('VALIDATION_FAILED', { field });
  return result;
}

function eventName(value: string): string {
  const result = value.trim();
  if (result.length === 0 || result.length > 128 || !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/.test(result)) {
    throw new DomainError('VALIDATION_FAILED', { field: 'event' });
  }
  return result;
}

function reference(value: string, field: string): string {
  const result = value.trim();
  if (result.length === 0 || result.length > 256 || /[\u0000-\u001f\u007f]/.test(result)) {
    throw new DomainError('VALIDATION_FAILED', { field });
  }
  return result;
}
