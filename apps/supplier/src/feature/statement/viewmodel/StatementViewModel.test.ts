import { expect, it } from 'vitest'; import { statementViewModel } from './StatementViewModel';
it('binds statements', () => expect(statementViewModel.routes).toEqual(['supplierstatements']));
