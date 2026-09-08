import { requireAccess } from '../../../../pipeline/OperationAccess';
import { keysetResult, queryPage } from '../../../../pipeline/Validation';
import type { FinanceScopeQuery } from './FinanceScopeQuery';
import type { FinanceEntries } from './FinanceOperation';

export function accountQueries(scopes: FinanceScopeQuery): FinanceEntries<'holdsRead'> {
  return {
    holdsRead: async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const allowed = await scopes.descendants(database, access.scope);
      const result = await database.query(
        `select hold.id,hold.scope_id,hold.account_id,hold.owner_type,hold.owner_id,hold.amount_minor,
        hold.state,hold.expires_at,hold.created_at,hold.updated_at,account.code,account.currency
        from finance.hold hold join finance.account account on account.id=hold.account_id
        where access.scope_allowed(hold.scope_id) and hold.scope_id=any($1::text[])
        and ($2::timestamptz is null or (hold.created_at,hold.id)<($2::timestamptz,$3))
        order by hold.created_at desc,hold.id desc limit $4`,
        [allowed, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'created_at');
    },
  };
}
