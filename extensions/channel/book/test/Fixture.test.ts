import { expect, it } from 'vitest';
import { assertProviderCatalog, assertProviderFixture } from '@shop/providercore/test';
import { BookCatalog } from '../Catalog';
import { BookMapper } from '../integration';
import { definition } from '../Manifest';

it('maps the book catalog fixture', () => expect(() => { assertProviderCatalog(definition, BookCatalog); assertProviderFixture(new BookMapper()); }).not.toThrow());

it('normalizes ISBN, publisher, set and presale data', () => {
  const [record] = new BookMapper().objects([{ isbn: '978-7-02-000220-7', updatedAt: '2026-09-06T00:00:00Z', publisher: '人民文学出版社', kind: 'set', presaleAt: '2026-09-20T00:00:00Z', stock: 5, priceCent: 8800 }], 'fixture');
  expect(record).toMatchObject({ externalId: '9787020002207', payload: { publisher: '人民文学出版社', kind: 'set', stock: 5 } });
});
