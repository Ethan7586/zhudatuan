import { ProductsCreateHandler } from '../handler/ProductsCreateHandler';
import { ProductsReviseHandler } from '../handler/ProductsReviseHandler';
import { ProductsEnableHandler } from '../handler/ProductsEnableHandler';
import { ProductsDisableHandler } from '../handler/ProductsDisableHandler';
import { ProductsGetHandler } from '../handler/ProductsGetHandler';
import { ProductsListHandler } from '../handler/ProductsListHandler';
import { ProductOptionsListHandler } from '../handler/ProductOptionsListHandler';
import { CredentialPoolsCreateHandler } from '../handler/CredentialPoolsCreateHandler';
import { CredentialsGenerateHandler } from '../handler/CredentialsGenerateHandler';
import { CredentialsImportHandler } from '../handler/CredentialsImportHandler';
import { CredentialPoolsCloseHandler } from '../handler/CredentialPoolsCloseHandler';
import { CredentialPoolsGetHandler } from '../handler/CredentialPoolsGetHandler';
import { CredentialPoolsListHandler } from '../handler/CredentialPoolsListHandler';
import { CredentialsListHandler } from '../handler/CredentialsListHandler';
import { CredentialsGetHandler } from '../handler/CredentialsGetHandler';
import { CredentialExportsCreateHandler } from '../handler/CredentialExportsCreateHandler';
import { JobsGetHandler } from '../handler/JobsGetHandler';
import { StockRequestsCreateHandler } from '../handler/StockRequestsCreateHandler';
import { StockRequestsUpdateHandler } from '../handler/StockRequestsUpdateHandler';
import { StockRequestsSubmitHandler } from '../handler/StockRequestsSubmitHandler';
import { StockRequestsCancelHandler } from '../handler/StockRequestsCancelHandler';
import { StockRequestsGetHandler } from '../handler/StockRequestsGetHandler';
import { StockRequestsListHandler } from '../handler/StockRequestsListHandler';
import { StockRequestOptionsListHandler } from '../handler/StockRequestOptionsListHandler';
import { IssueOrdersCreateHandler } from '../handler/IssueOrdersCreateHandler';
import { IssueOrdersUpdateHandler } from '../handler/IssueOrdersUpdateHandler';
import { IssueOrdersSubmitHandler } from '../handler/IssueOrdersSubmitHandler';
import { IssueOrdersCancelHandler } from '../handler/IssueOrdersCancelHandler';
import { IssueOrdersGetHandler } from '../handler/IssueOrdersGetHandler';
import { IssueOrdersListHandler } from '../handler/IssueOrdersListHandler';
import { IssueBatchesRetryHandler } from '../handler/IssueBatchesRetryHandler';
import { IssueBatchesGetHandler } from '../handler/IssueBatchesGetHandler';
import { IssueOrderExportsCreateHandler } from '../handler/IssueOrderExportsCreateHandler';
import { ActionBatchesCreateHandler } from '../handler/ActionBatchesCreateHandler';
import { ActionBatchesGetHandler } from '../handler/ActionBatchesGetHandler';
import { ActionBatchesListHandler } from '../handler/ActionBatchesListHandler';
import { ActionBatchesRetryHandler } from '../handler/ActionBatchesRetryHandler';
import { ActionExportsCreateHandler } from '../handler/ActionExportsCreateHandler';
import { SearchReadHandler } from '../handler/SearchReadHandler';
import { ActivationsSecretHandler } from '../handler/ActivationsSecretHandler';
import { ActivationsNumberSecretHandler } from '../handler/ActivationsNumberSecretHandler';
import { VouchersBindHandler } from '../handler/VouchersBindHandler';
import { VouchersUnbindHandler } from '../handler/VouchersUnbindHandler';
import { VouchersGetHandler } from '../handler/VouchersGetHandler';
import { VouchersGetByNumberHandler } from '../handler/VouchersGetByNumberHandler';
import { VouchersTimelineHandler } from '../handler/VouchersTimelineHandler';
import { RedemptionsQuoteHandler } from '../handler/RedemptionsQuoteHandler';
import { TenderHoldsCreateHandler } from '../handler/TenderHoldsCreateHandler';
import { TenderHoldsConsumeHandler } from '../handler/TenderHoldsConsumeHandler';
import { TenderHoldsReleaseHandler } from '../handler/TenderHoldsReleaseHandler';
import { RedemptionsCreateHandler } from '../handler/RedemptionsCreateHandler';
import { RefundsCreateHandler } from '../handler/RefundsCreateHandler';
import { RedemptionsGetHandler } from '../handler/RedemptionsGetHandler';
import { SearchFacetsReadHandler } from '../handler/SearchFacetsReadHandler';
import { SearchSnapshotsCreateHandler } from '../handler/SearchSnapshotsCreateHandler';
import { SearchExportsCreateHandler } from '../handler/SearchExportsCreateHandler';
import { VoucherApplication } from './VoucherApplication';

export function createVoucherHandlers(application: VoucherApplication) {
  return [
    new ProductsCreateHandler(application),
    new ProductsReviseHandler(application),
    new ProductsEnableHandler(application),
    new ProductsDisableHandler(application),
    new ProductsGetHandler(application),
    new ProductsListHandler(application),
    new ProductOptionsListHandler(application),
    new CredentialPoolsCreateHandler(application),
    new CredentialsGenerateHandler(application),
    new CredentialsImportHandler(application),
    new CredentialPoolsCloseHandler(application),
    new CredentialPoolsGetHandler(application),
    new CredentialPoolsListHandler(application),
    new CredentialsListHandler(application),
    new CredentialsGetHandler(application),
    new CredentialExportsCreateHandler(application),
    new JobsGetHandler(application),
    new StockRequestsCreateHandler(application),
    new StockRequestsUpdateHandler(application),
    new StockRequestsSubmitHandler(application),
    new StockRequestsCancelHandler(application),
    new StockRequestsGetHandler(application),
    new StockRequestsListHandler(application),
    new StockRequestOptionsListHandler(application),
    new IssueOrdersCreateHandler(application),
    new IssueOrdersUpdateHandler(application),
    new IssueOrdersSubmitHandler(application),
    new IssueOrdersCancelHandler(application),
    new IssueOrdersGetHandler(application),
    new IssueOrdersListHandler(application),
    new IssueBatchesRetryHandler(application),
    new IssueBatchesGetHandler(application),
    new IssueOrderExportsCreateHandler(application),
    new ActionBatchesCreateHandler(application),
    new ActionBatchesGetHandler(application),
    new ActionBatchesListHandler(application),
    new ActionBatchesRetryHandler(application),
    new ActionExportsCreateHandler(application),
    new SearchReadHandler(application),
    new ActivationsSecretHandler(application),
    new ActivationsNumberSecretHandler(application),
    new VouchersBindHandler(application),
    new VouchersUnbindHandler(application),
    new VouchersGetHandler(application),
    new VouchersGetByNumberHandler(application),
    new VouchersTimelineHandler(application),
    new RedemptionsQuoteHandler(application),
    new TenderHoldsCreateHandler(application),
    new TenderHoldsConsumeHandler(application),
    new TenderHoldsReleaseHandler(application),
    new RedemptionsCreateHandler(application),
    new RefundsCreateHandler(application),
    new RedemptionsGetHandler(application),
    new SearchFacetsReadHandler(application),
    new SearchSnapshotsCreateHandler(application),
    new SearchExportsCreateHandler(application),
  ];
}
