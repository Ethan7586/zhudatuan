import { defineSelectedModule } from '../../bootstrap/DefinedModule';
import { FINANCE_OPERATOR_READ_OPERATION_IDS, financeOperatorReadOperations } from './FinanceReadOperations';

export const IdentityOperatorFinanceModule = defineSelectedModule(
  'finance', FINANCE_OPERATOR_READ_OPERATION_IDS, financeOperatorReadOperations, ['identity'],
);
