import { DomainError } from '../../../../platform/error/DomainError';

export type AddressState = 'active' | 'deleted';

export interface AddressEntry {
  readonly id: string;
  readonly state: AddressState;
  readonly isDefault: boolean;
  readonly version: number;
}

export interface SaveAddressDecision {
  readonly id: string;
  readonly isDefault: boolean;
  readonly expectedVersion: number;
}

export interface RemoveAddressDecision {
  readonly id: string;
  readonly expectedVersion: number;
  readonly promote: string | null;
}

export class AddressBook {
  readonly member: string;
  readonly entries: readonly AddressEntry[];

  constructor(member: string, entries: readonly AddressEntry[]) {
    if (!member.startsWith('member:')) invalid('memberId');
    const ids = new Set<string>();
    let defaults = 0;
    for (const entry of entries) {
      if (!entry.id.startsWith('address:') || ids.has(entry.id)) invalid('addressId');
      if (!['active', 'deleted'].includes(entry.state)) invalid('status');
      if (!Number.isSafeInteger(entry.version) || entry.version < 0) invalid('version');
      if (entry.state === 'deleted' && entry.isDefault) invalid('isDefault');
      if (entry.state === 'active' && entry.isDefault) defaults += 1;
      ids.add(entry.id);
    }
    if (defaults > 1) throw new Error('MEMBER_DEFAULT_ADDRESS_DUPLICATE');
    this.member = member;
    this.entries = Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
    Object.freeze(this);
  }

  save(id: string, expectedVersion: number, requestedDefault: boolean): SaveAddressDecision {
    const current = this.entries.find((entry) => entry.id === id);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) invalid('expectedVersion');
    if (current && current.version !== expectedVersion) throw new DomainError('VERSION_CONFLICT');
    if (!current && expectedVersion !== 0) throw new DomainError('VERSION_CONFLICT');
    const hasDefault = this.entries.some((entry) => entry.state === 'active' && entry.isDefault && entry.id !== id);
    const isDefault = requestedDefault || current?.isDefault === true || !hasDefault;
    return Object.freeze({ id, isDefault, expectedVersion });
  }

  remove(id: string, expectedVersion: number): RemoveAddressDecision {
    const current = this.entries.find((entry) => entry.id === id && entry.state === 'active');
    if (!current || current.version !== expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const promote = current.isDefault ? (this.entries.find((entry) => entry.id !== id && entry.state === 'active')?.id ?? null) : null;
    return Object.freeze({ id, expectedVersion, promote });
  }
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
