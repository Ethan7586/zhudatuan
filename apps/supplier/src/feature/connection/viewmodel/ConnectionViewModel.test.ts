import { expect, it } from 'vitest'; import { connectionViewModel } from './ConnectionViewModel';
it('binds connections', () => expect(connectionViewModel.routes).toEqual(['supplierconnections']));
