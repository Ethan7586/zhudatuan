import { defineModule } from '../../bootstrap/DefinedModule';
import { financeRoutes } from './05_interface_jieru/http/FinanceRoutes';
export const FinanceModule = defineModule('finance', ['reporting'], financeRoutes);
export { FinancePort, type HoldIntent, type PostingIntent } from './03_application_yingyong/port/FinancePort';
