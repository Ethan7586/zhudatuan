import { defineQueryState, integerQuery, optionalQuery, stringQuery } from '../../../shared/query/QueryState';

export const productQuery = defineQueryState({
  q: stringQuery('', 255),
  category: stringQuery('', 255),
  supplier: stringQuery('', 255),
  mall: stringQuery('', 255),
  status: stringQuery('', 64),
  limit: integerQuery(50, [20, 50, 100]),
  page: integerQuery(1),
  cursor: optionalQuery(),
  selected: optionalQuery(255),
});
