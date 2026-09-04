import { defineSelectedModule } from '../../../bootstrap/DefinedModule';
import { REPORTING_OPERATOR_READ_OPERATION_IDS, reportingOperatorReadOperations } from '../03_application_yingyong/ReportingReadOperations';

export const IdentityOperatorReportingModule = defineSelectedModule(
  'reporting', REPORTING_OPERATOR_READ_OPERATION_IDS, reportingOperatorReadOperations, ['identity'],
);
