import { DomainError } from '../../../../platform/error/DomainError';
import { bodyRecord, optionalText } from '../../../../pipeline/Validation';
import { VoucherNumber } from '../../domain/value/VoucherNumber';
import type { CredentialProtector } from '../port/CredentialProtector';
import type { SearchFilter, SearchInput } from '../port/SearchFilter';
import type { VoucherSearch } from '../port/VoucherSearch';
export class PreparedVoucherSearch implements VoucherSearch {
  constructor(
    private readonly search: VoucherSearch,
    private readonly protector: Pick<CredentialProtector, 'fingerprint'>
  ) {}
  async prepare(input: SearchInput, scope: string): Promise<SearchFilter> {
    const raw = 'body' in input ? bodyRecord(input).filter : (input.query ?? {});
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new DomainError('VALIDATION_FAILED', { field: 'filter' });
    const source = raw as Readonly<Record<string, unknown>>;
    const criteria: Record<string, string> = {};
    for (const field of ['product', 'pool', 'customer', 'holder', 'state', 'expiresBefore', 'expiresAfter']) {
      const value = optionalText(source, field);
      if (value) criteria[field] = value;
    }
    for (const field of ['expiresBefore', 'expiresAfter']) {
      if (criteria[field] && !Number.isFinite(Date.parse(criteria[field]!))) throw new DomainError('VALIDATION_FAILED', { field });
    }
    if (criteria.expiresBefore && criteria.expiresAfter && Date.parse(criteria.expiresAfter) >= Date.parse(criteria.expiresBefore)) {
      throw new DomainError('VALIDATION_FAILED', { field: 'expiresAfter' });
    }
    const query = optionalText(source, 'query', 128) || null;
    if (query && /[\u0000-\u001f\u007f]/u.test(query)) throw new DomainError('VALIDATION_FAILED', { field: 'query' });
    const indexed = query && /^[a-z0-9]{8,40}$/iu.test(query) ? new VoucherNumber(query).value : query;
    const fingerprint = indexed && indexed.length >= 6 ? await this.protector.fingerprint(indexed, 'number', scope) : null;
    return Object.freeze({ criteria: Object.freeze(criteria), query, fingerprint });
  }
  number(value: string, scope: string): Promise<string> {
    return this.protector.fingerprint(new VoucherNumber(value).value, 'number', scope);
  }
  read(call: Parameters<VoucherSearch['read']>[0], filter: SearchFilter) {
    return this.search.read(call, filter);
  }
  facets(call: Parameters<VoucherSearch['facets']>[0], filter: SearchFilter) {
    return this.search.facets(call, filter);
  }
  snapshot(call: Parameters<VoucherSearch['snapshot']>[0], filter: SearchFilter) {
    return this.search.snapshot(call, filter);
  }
}
