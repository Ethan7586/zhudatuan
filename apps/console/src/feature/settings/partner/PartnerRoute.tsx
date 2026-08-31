import { createFetchPartnerPartnersRead } from '@shop/sdk/partner';
import { OperationPage } from '../../../entity/operation/OperationPage';
import { consoleRequest } from '../../../shared/api/Client';
import { appConfig } from '../../../shared/config/AppConfig';

const read = createFetchPartnerPartnersRead(appConfig.apiBaseUrl);
export function Component() {
  return (
    <OperationPage
      operation="partner.partners.read"
      title="供应商与门店"
      description="合作方、供应商、品牌与门店状态来自 Partner 模块；资质审批仍由 Qualification 独立治理。"
      load={(context, signal) => read({ query: { limit: 50 } }, consoleRequest(context.scope, signal, context.session.accessVersion))}
    />
  );
}
