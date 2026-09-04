import { defineModule } from '../../bootstrap/DefinedModule';
import { financeRoutes } from './interface/http/FinanceRoutes';
export const FinanceModule = defineModule('finance', ['reporting'], financeRoutes);
export { FinancePort, type HoldIntent, type PostingIntent } from './application/port/FinancePort';
