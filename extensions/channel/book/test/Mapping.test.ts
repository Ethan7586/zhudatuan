import { expect, it } from 'vitest';
import { assertProviderMappingFailure } from '@shop/providercore/test';
import { BookMapper } from '../integration';

it('rejects incomplete book records', () => expect(() => assertProviderMappingFailure(new BookMapper())).not.toThrow());

it('rejects invalid ISBN values', () => expect(() => new BookMapper().objects([{ isbn: '9780000000000', updatedAt: 'v1', publisher: '出版社', kind: 'single', presaleAt: null, stock: 1, priceCent: 1 }], 'mapping')).toThrow('BOOK_ISBN_INVALID'));
