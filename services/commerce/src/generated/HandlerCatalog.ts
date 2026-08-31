// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import type { OperationHandlerType } from '../foundation/application/OperationHandler';
import { HealthLiveHandler as Handler0 } from '../foundation/application/handler/HealthLiveHandler';
import { HealthReadyHandler as Handler1 } from '../foundation/application/handler/HealthReadyHandler';
import { HealthStartupHandler as Handler2 } from '../foundation/application/handler/HealthStartupHandler';
import { HealthDependencyHandler as Handler3 } from '../foundation/application/handler/HealthDependencyHandler';
import { SessionsCreateHandler as Handler4 } from '../modules/identity/interface/handler/SessionsCreateHandler';
import { SessionsCompleteHandler as Handler5 } from '../modules/identity/interface/handler/SessionsCompleteHandler';
import { TicketsExchangeHandler as Handler6 } from '../modules/identity/application/handler/TicketsExchangeHandler';
import { SessionReadHandler as Handler7 } from '../modules/identity/application/handler/SessionReadHandler';
import { SessionDeleteHandler as Handler8 } from '../modules/identity/application/handler/SessionDeleteHandler';
import { SessionsReadHandler as Handler9 } from '../modules/identity/application/handler/SessionsReadHandler';
import { SessionsRevokeHandler as Handler10 } from '../modules/identity/application/handler/SessionsRevokeHandler';
import { MembershipsReadHandler as Handler11 } from '../modules/identity/application/handler/MembershipsReadHandler';
import { MembershipsSwitchHandler as Handler12 } from '../modules/identity/application/handler/MembershipsSwitchHandler';
import { ChallengesCreateHandler as Handler13 } from '../modules/identity/application/handler/ChallengesCreateHandler';
import { InvitationsResolveHandler as Handler14 } from '../modules/identity/interface/handler/InvitationsResolveHandler';
import { InvitationsReadHandler as Handler15 } from '../modules/identity/interface/handler/InvitationsReadHandler';
import { InvitationsCreateHandler as Handler16 } from '../modules/identity/interface/handler/InvitationsCreateHandler';
import { InvitationsRevokeHandler as Handler17 } from '../modules/identity/interface/handler/InvitationsRevokeHandler';
import { EnrollmentsReadHandler as Handler18 } from '../modules/identity/interface/handler/EnrollmentsReadHandler';
import { EnrollmentsCompleteHandler as Handler19 } from '../modules/identity/interface/handler/EnrollmentsCompleteHandler';
import { MembersManageHandler as Handler20 } from '../modules/identity/application/handler/MembersManageHandler';
import { PasswordChangeHandler as Handler21 } from '../modules/identity/application/handler/PasswordChangeHandler';
import { PasswordVerifyHandler as Handler22 } from '../modules/identity/application/handler/PasswordVerifyHandler';
import { PasswordResetHandler as Handler23 } from '../modules/identity/application/handler/PasswordResetHandler';
import { MobileManageHandler as Handler24 } from '../modules/identity/application/handler/MobileManageHandler';
import { StepupStartHandler as Handler25 } from '../modules/identity/application/handler/StepupStartHandler';
import { StepupCompleteHandler as Handler26 } from '../modules/identity/application/handler/StepupCompleteHandler';
import { LayersReadHandler as Handler27 } from '../modules/organization/application/handler/LayersReadHandler';
import { CenterReadHandler as Handler28 } from '../modules/access/application/handler/CenterReadHandler';
import { OwnersTransferHandler as Handler29 } from '../modules/access/application/handler/OwnersTransferHandler';
import { RolesManageHandler as Handler30 } from '../modules/access/application/handler/RolesManageHandler';
import { OverridesManageHandler as Handler31 } from '../modules/access/application/handler/OverridesManageHandler';
import { ScopesManageHandler as Handler32 } from '../modules/access/application/handler/ScopesManageHandler';
import { AssignmentsReadHandler as Handler33 } from '../modules/capability/application/handler/AssignmentsReadHandler';
import { AssignmentsManageHandler as Handler34 } from '../modules/capability/application/handler/AssignmentsManageHandler';
import { PartnersReadHandler as Handler35 } from '../modules/partner/application/handler/PartnersReadHandler';
import { PartnersManageHandler as Handler36 } from '../modules/partner/application/handler/PartnersManageHandler';
import { StoresReadHandler as Handler37 } from '../modules/partner/application/handler/StoresReadHandler';
import { StoresManageHandler as Handler38 } from '../modules/partner/application/handler/StoresManageHandler';
import { MembersReadHandler as Handler39 } from '../modules/member/application/handler/MembersReadHandler';
import { ProfileReadHandler as Handler40 } from '../modules/member/application/handler/ProfileReadHandler';
import { AddressesReadHandler as Handler41 } from '../modules/member/application/handler/AddressesReadHandler';
import { AddressesManageHandler as Handler42 } from '../modules/member/application/handler/AddressesManageHandler';
import { FavoritesReadHandler as Handler43 } from '../modules/member/application/handler/FavoritesReadHandler';
import { FavoritesPutHandler as Handler44 } from '../modules/member/application/handler/FavoritesPutHandler';
import { ImportsCreateHandler as Handler45 } from '../modules/member/application/handler/ImportsCreateHandler';
import { ImportsReadHandler as Handler46 } from '../modules/member/application/handler/ImportsReadHandler';
import { CenterReadHandler as Handler47 } from '../modules/qualification/application/handler/CenterReadHandler';
import { DecisionsPreviewHandler as Handler48 } from '../modules/qualification/application/handler/DecisionsPreviewHandler';
import { PoliciesManageHandler as Handler49 } from '../modules/qualification/application/handler/PoliciesManageHandler';
import { DistributorsCreateHandler as Handler50 } from '../modules/channel/application/handler/DistributorsCreateHandler';
import { DistributorsReadHandler as Handler51 } from '../modules/channel/application/handler/DistributorsReadHandler';
import { DistributorsUpdateHandler as Handler52 } from '../modules/channel/application/handler/DistributorsUpdateHandler';
import { DistributorsDisableHandler as Handler53 } from '../modules/channel/application/handler/DistributorsDisableHandler';
import { BindingsManageHandler as Handler54 } from '../modules/channel/application/handler/BindingsManageHandler';
import { QuotasManageHandler as Handler55 } from '../modules/channel/application/handler/QuotasManageHandler';
import { PoolsReadHandler as Handler56 } from '../modules/catalog/application/handler/PoolsReadHandler';
import { PoolsAttachHandler as Handler57 } from '../modules/catalog/application/handler/PoolsAttachHandler';
import { PoolsDetachHandler as Handler58 } from '../modules/catalog/application/handler/PoolsDetachHandler';
import { PoolsAllocateHandler as Handler59 } from '../modules/catalog/application/handler/PoolsAllocateHandler';
import { ProductDetailReadHandler as Handler60 } from '../modules/catalog/application/handler/ProductDetailReadHandler';
import { ProductsCreateHandler as Handler61 } from '../modules/catalog/application/handler/ProductsCreateHandler';
import { ProductsUpdateHandler as Handler62 } from '../modules/catalog/application/handler/ProductsUpdateHandler';
import { ProductsArchiveHandler as Handler63 } from '../modules/catalog/application/handler/ProductsArchiveHandler';
import { ListingsReadHandler as Handler64 } from '../modules/catalog/application/handler/ListingsReadHandler';
import { ListingsPublishHandler as Handler65 } from '../modules/catalog/application/handler/ListingsPublishHandler';
import { ListingsUnpublishHandler as Handler66 } from '../modules/catalog/application/handler/ListingsUnpublishHandler';
import { ListingsBatchHandler as Handler67 } from '../modules/catalog/application/handler/ListingsBatchHandler';
import { ImportsCreateHandler as Handler68 } from '../modules/catalog/application/handler/ImportsCreateHandler';
import { ImportsReadHandler as Handler69 } from '../modules/catalog/application/handler/ImportsReadHandler';
import { RulesCreateHandler as Handler70 } from '../modules/pricing/application/handler/RulesCreateHandler';
import { RulesPublishHandler as Handler71 } from '../modules/pricing/application/handler/RulesPublishHandler';
import { ImportsCreateHandler as Handler72 } from '../modules/inventory/application/handler/ImportsCreateHandler';
import { ImportsReadHandler as Handler73 } from '../modules/inventory/application/handler/ImportsReadHandler';
import { CampaignsReadHandler as Handler74 } from '../modules/marketing/application/handler/CampaignsReadHandler';
import { DashboardReadHandler as Handler75 } from '../modules/reporting/application/handler/DashboardReadHandler';
import { SalesReadHandler as Handler76 } from '../modules/reporting/application/handler/SalesReadHandler';
import { ProductsReadHandler as Handler77 } from '../modules/reporting/application/handler/ProductsReadHandler';
import { MallsReadHandler as Handler78 } from '../modules/reporting/application/handler/MallsReadHandler';
import { CategoriesReadHandler as Handler79 } from '../modules/reporting/application/handler/CategoriesReadHandler';
import { ChannelsReadHandler as Handler80 } from '../modules/reporting/application/handler/ChannelsReadHandler';
import { PowderclassReadHandler as Handler81 } from '../modules/reporting/application/handler/PowderclassReadHandler';
import { VoucherconsumptionReadHandler as Handler82 } from '../modules/reporting/application/handler/VoucherconsumptionReadHandler';
import { ExportsCreateHandler as Handler83 } from '../modules/reporting/application/handler/ExportsCreateHandler';
import { ExportsReadHandler as Handler84 } from '../modules/reporting/application/handler/ExportsReadHandler';
import { ApplicationsCreateHandler as Handler85 } from '../modules/experience/application/handler/ApplicationsCreateHandler';
import { ApplicationsCopyHandler as Handler86 } from '../modules/experience/application/handler/ApplicationsCopyHandler';
import { ApplicationsReadHandler as Handler87 } from '../modules/experience/application/handler/ApplicationsReadHandler';
import { ApplicationsUpdateHandler as Handler88 } from '../modules/experience/application/handler/ApplicationsUpdateHandler';
import { VersionsSaveHandler as Handler89 } from '../modules/experience/application/handler/VersionsSaveHandler';
import { VersionsValidateHandler as Handler90 } from '../modules/experience/application/handler/VersionsValidateHandler';
import { VersionsPublishHandler as Handler91 } from '../modules/experience/application/handler/VersionsPublishHandler';
import { VersionsRestoreHandler as Handler92 } from '../modules/experience/application/handler/VersionsRestoreHandler';
import { CurrentReadHandler as Handler93 } from '../modules/cart/application/handler/CurrentReadHandler';
import { ItemsPutHandler as Handler94 } from '../modules/cart/application/handler/ItemsPutHandler';
import { ItemsBatchHandler as Handler95 } from '../modules/cart/application/handler/ItemsBatchHandler';
import { QuoteCreateHandler as Handler96 } from '../modules/checkout/application/handler/QuoteCreateHandler';
import { ConfirmQuoteHandler as Handler97 } from '../modules/checkout/application/handler/ConfirmQuoteHandler';
import { OrdersReadHandler as Handler98 } from '../modules/order/application/handler/OrdersReadHandler';
import { RemindersCreateHandler as Handler99 } from '../modules/order/application/handler/RemindersCreateHandler';
import { OrdersExportHandler as Handler100 } from '../modules/order/application/handler/OrdersExportHandler';
import { AftersalesReadHandler as Handler101 } from '../modules/order/application/handler/AftersalesReadHandler';
import { AftersalesApplyHandler as Handler102 } from '../modules/order/application/handler/AftersalesApplyHandler';
import { AftersalesApproveHandler as Handler103 } from '../modules/order/application/handler/AftersalesApproveHandler';
import { AftersalesRejectHandler as Handler104 } from '../modules/order/application/handler/AftersalesRejectHandler';
import { ShipmentsCreateHandler as Handler105 } from '../modules/fulfillment/application/handler/ShipmentsCreateHandler';
import { TrackingReadHandler as Handler106 } from '../modules/fulfillment/application/handler/TrackingReadHandler';
import { ReturnsReceiveHandler as Handler107 } from '../modules/fulfillment/application/handler/ReturnsReceiveHandler';
import { ReturnsInspectHandler as Handler108 } from '../modules/fulfillment/application/handler/ReturnsInspectHandler';
import { IntentsReadHandler as Handler109 } from '../modules/payment/application/handler/IntentsReadHandler';
import { ChallengesIssueHandler as Handler110 } from '../modules/verification/application/handler/ChallengesIssueHandler';
import { SessionsReadHandler as Handler111 } from '../modules/verification/application/handler/SessionsReadHandler';
import { ChallengesVerifyHandler as Handler112 } from '../modules/verification/application/handler/ChallengesVerifyHandler';
import { HistoryReadHandler as Handler113 } from '../modules/verification/application/handler/HistoryReadHandler';
import { DevicesReadHandler as Handler114 } from '../modules/verification/application/handler/DevicesReadHandler';
import { DevicesManageHandler as Handler115 } from '../modules/verification/application/handler/DevicesManageHandler';
import { RefundsRequestHandler as Handler116 } from '../modules/payment/application/handler/RefundsRequestHandler';
import { RecoveriesReadHandler as Handler117 } from '../modules/payment/application/handler/RecoveriesReadHandler';
import { RecoveriesResolveHandler as Handler118 } from '../modules/payment/application/handler/RecoveriesResolveHandler';
import { WebhooksWechatHandler as Handler119 } from '../modules/payment/application/handler/WebhooksWechatHandler';
import { CardlibrariesReadHandler as Handler120 } from '../modules/voucher/application/handler/CardlibrariesReadHandler';
import { CardlibrariesCreateHandler as Handler121 } from '../modules/voucher/application/handler/CardlibrariesCreateHandler';
import { CardlibrariesAllocateHandler as Handler122 } from '../modules/voucher/application/handler/CardlibrariesAllocateHandler';
import { ImportsReadHandler as Handler123 } from '../modules/voucher/application/handler/ImportsReadHandler';
import { ProgramsReadHandler as Handler124 } from '../modules/voucher/application/handler/ProgramsReadHandler';
import { ProgramsManageHandler as Handler125 } from '../modules/voucher/application/handler/ProgramsManageHandler';
import { ReservesReadHandler as Handler126 } from '../modules/voucher/application/handler/ReservesReadHandler';
import { ReservesRequestHandler as Handler127 } from '../modules/voucher/application/handler/ReservesRequestHandler';
import { ReservesDecideHandler as Handler128 } from '../modules/voucher/application/handler/ReservesDecideHandler';
import { BatchesReadHandler as Handler129 } from '../modules/voucher/application/handler/BatchesReadHandler';
import { BatchesIssueHandler as Handler130 } from '../modules/voucher/application/handler/BatchesIssueHandler';
import { BatchesRetryHandler as Handler131 } from '../modules/voucher/application/handler/BatchesRetryHandler';
import { StatusBatchHandler as Handler132 } from '../modules/voucher/application/handler/StatusBatchHandler';
import { StatusbatchesReadHandler as Handler133 } from '../modules/voucher/application/handler/StatusbatchesReadHandler';
import { BindingsReadHandler as Handler134 } from '../modules/voucher/application/handler/BindingsReadHandler';
import { BindingsManageHandler as Handler135 } from '../modules/voucher/application/handler/BindingsManageHandler';
import { RedemptionsReadHandler as Handler136 } from '../modules/voucher/application/handler/RedemptionsReadHandler';
import { HistoryReadHandler as Handler137 } from '../modules/voucher/application/handler/HistoryReadHandler';
import { RedemptionsReverseHandler as Handler138 } from '../modules/voucher/application/handler/RedemptionsReverseHandler';
import { AccountsReadHandler as Handler139 } from '../modules/benefit/application/handler/AccountsReadHandler';
import { LedgersReadHandler as Handler140 } from '../modules/benefit/application/handler/LedgersReadHandler';
import { PlansReadHandler as Handler141 } from '../modules/benefit/application/handler/PlansReadHandler';
import { PlansManageHandler as Handler142 } from '../modules/benefit/application/handler/PlansManageHandler';
import { BudgetsReadHandler as Handler143 } from '../modules/benefit/application/handler/BudgetsReadHandler';
import { BudgetsManageHandler as Handler144 } from '../modules/benefit/application/handler/BudgetsManageHandler';
import { GrantsCreateHandler as Handler145 } from '../modules/benefit/application/handler/GrantsCreateHandler';
import { GrantsDecideHandler as Handler146 } from '../modules/benefit/application/handler/GrantsDecideHandler';
import { GrantsReadHandler as Handler147 } from '../modules/benefit/application/handler/GrantsReadHandler';
import { GrantsControlHandler as Handler148 } from '../modules/benefit/application/handler/GrantsControlHandler';
import { GrantsRevokeHandler as Handler149 } from '../modules/benefit/application/handler/GrantsRevokeHandler';
import { LotsReadHandler as Handler150 } from '../modules/benefit/application/handler/LotsReadHandler';
import { OverviewReadHandler as Handler151 } from '../modules/finance/application/handler/OverviewReadHandler';
import { EntriesReadHandler as Handler152 } from '../modules/finance/application/handler/EntriesReadHandler';
import { StatementsReadHandler as Handler153 } from '../modules/finance/application/handler/StatementsReadHandler';
import { StatementsExportHandler as Handler154 } from '../modules/finance/application/handler/StatementsExportHandler';
import { ReconciliationsManageHandler as Handler155 } from '../modules/finance/application/handler/ReconciliationsManageHandler';
import { ReconciliationsReadHandler as Handler156 } from '../modules/finance/application/handler/ReconciliationsReadHandler';
import { SettlementsReadHandler as Handler157 } from '../modules/finance/application/handler/SettlementsReadHandler';
import { SettlementsDecideHandler as Handler158 } from '../modules/finance/application/handler/SettlementsDecideHandler';
import { SettlementsAdjustHandler as Handler159 } from '../modules/finance/application/handler/SettlementsAdjustHandler';
import { WithdrawalsReadHandler as Handler160 } from '../modules/finance/application/handler/WithdrawalsReadHandler';
import { WithdrawalsCreateHandler as Handler161 } from '../modules/finance/application/handler/WithdrawalsCreateHandler';
import { WithdrawalsDecideHandler as Handler162 } from '../modules/finance/application/handler/WithdrawalsDecideHandler';
import { WithdrawalsRecoverHandler as Handler163 } from '../modules/finance/application/handler/WithdrawalsRecoverHandler';
import { HoldsReadHandler as Handler164 } from '../modules/finance/application/handler/HoldsReadHandler';
import { PeriodsReadHandler as Handler165 } from '../modules/finance/application/handler/PeriodsReadHandler';
import { PeriodsManageHandler as Handler166 } from '../modules/finance/application/handler/PeriodsManageHandler';
import { BackfillsReadHandler as Handler167 } from '../modules/finance/application/handler/BackfillsReadHandler';
import { BackfillsDecideHandler as Handler168 } from '../modules/finance/application/handler/BackfillsDecideHandler';
import { PoliciesManageHandler as Handler169 } from '../modules/finance/application/handler/PoliciesManageHandler';
import { InvoicesReadHandler as Handler170 } from '../modules/finance/application/handler/InvoicesReadHandler';
import { InvoicesDownloadHandler as Handler171 } from '../modules/finance/application/handler/InvoicesDownloadHandler';
import { ProfilesManageHandler as Handler172 } from '../modules/finance/application/handler/ProfilesManageHandler';
import { ProfilesReadHandler as Handler173 } from '../modules/finance/application/handler/ProfilesReadHandler';
import { RequestsCreateHandler as Handler174 } from '../modules/finance/application/handler/RequestsCreateHandler';
import { RequestsReadHandler as Handler175 } from '../modules/finance/application/handler/RequestsReadHandler';
import { RequestsCancelHandler as Handler176 } from '../modules/finance/application/handler/RequestsCancelHandler';
import { RequestsDecideHandler as Handler177 } from '../modules/finance/application/handler/RequestsDecideHandler';
import { RequestsRedHandler as Handler178 } from '../modules/finance/application/handler/RequestsRedHandler';
import { CasesCreateHandler as Handler179 } from '../modules/support/application/handler/CasesCreateHandler';
import { CasesReadHandler as Handler180 } from '../modules/support/application/handler/CasesReadHandler';
import { CasesUpdateHandler as Handler181 } from '../modules/support/application/handler/CasesUpdateHandler';
import { CasesCloseHandler as Handler182 } from '../modules/support/application/handler/CasesCloseHandler';
import { CasesReopenHandler as Handler183 } from '../modules/support/application/handler/CasesReopenHandler';
import { MessagesSendHandler as Handler184 } from '../modules/support/application/handler/MessagesSendHandler';
import { MessagesReadHandler as Handler185 } from '../modules/support/application/handler/MessagesReadHandler';
import { AttachmentsCreateHandler as Handler186 } from '../modules/support/application/handler/AttachmentsCreateHandler';
import { AssignmentsManageHandler as Handler187 } from '../modules/support/application/handler/AssignmentsManageHandler';
import { AgentsManageHandler as Handler188 } from '../modules/support/application/handler/AgentsManageHandler';
import { AgentsReadHandler as Handler189 } from '../modules/support/application/handler/AgentsReadHandler';
import { AccountsManageHandler as Handler190 } from '../modules/support/application/handler/AccountsManageHandler';
import { AccountsReadHandler as Handler191 } from '../modules/support/application/handler/AccountsReadHandler';
import { RulesReadHandler as Handler192 } from '../modules/support/application/handler/RulesReadHandler';
import { RulesManageHandler as Handler193 } from '../modules/support/application/handler/RulesManageHandler';
import { SlasReadHandler as Handler194 } from '../modules/support/application/handler/SlasReadHandler';
import { SlasManageHandler as Handler195 } from '../modules/support/application/handler/SlasManageHandler';
import { HistoryReadHandler as Handler196 } from '../modules/support/application/handler/HistoryReadHandler';
import { NotificationsReadHandler as Handler197 } from '../modules/notification/application/handler/NotificationsReadHandler';
import { NotificationsAckHandler as Handler198 } from '../modules/notification/application/handler/NotificationsAckHandler';
import { PreferencesReadHandler as Handler199 } from '../modules/notification/application/handler/PreferencesReadHandler';
import { PreferencesManageHandler as Handler200 } from '../modules/notification/application/handler/PreferencesManageHandler';
import { EndpointsManageHandler as Handler201 } from '../modules/notification/application/handler/EndpointsManageHandler';
import { TemplatesManageHandler as Handler202 } from '../modules/notification/application/handler/TemplatesManageHandler';
import { TemplatesReadHandler as Handler203 } from '../modules/notification/application/handler/TemplatesReadHandler';
import { AnnouncementsReadHandler as Handler204 } from '../modules/notification/application/handler/AnnouncementsReadHandler';
import { AnnouncementsManageHandler as Handler205 } from '../modules/notification/application/handler/AnnouncementsManageHandler';
import { CenterReadHandler as Handler206 } from '../modules/risk/application/handler/CenterReadHandler';
import { PoliciesManageHandler as Handler207 } from '../modules/risk/application/handler/PoliciesManageHandler';
import { CasesReviewHandler as Handler208 } from '../modules/risk/application/handler/CasesReviewHandler';
import { RecordsReadHandler as Handler209 } from '../modules/audit/application/handler/RecordsReadHandler';
import { ClienterrorsCreateHandler as Handler210 } from '../foundation/application/handler/ClienterrorsCreateHandler';
import { ClienterrorsReadHandler as Handler211 } from '../foundation/application/handler/ClienterrorsReadHandler';
import { ConnectionsReadHandler as Handler212 } from '../modules/channel/application/handler/ConnectionsReadHandler';
import { ConnectionsCreateHandler as Handler213 } from '../modules/channel/application/handler/ConnectionsCreateHandler';
import { ConnectionsUpdateHandler as Handler214 } from '../modules/channel/application/handler/ConnectionsUpdateHandler';
import { ConnectionsTestHandler as Handler215 } from '../modules/channel/application/handler/ConnectionsTestHandler';
import { ConnectionsEnableHandler as Handler216 } from '../modules/channel/application/handler/ConnectionsEnableHandler';
import { ConnectionsDisableHandler as Handler217 } from '../modules/channel/application/handler/ConnectionsDisableHandler';
import { WebhooksReceiveHandler as Handler218 } from '../modules/channel/application/handler/WebhooksReceiveHandler';
import { SyncrunsStartHandler as Handler219 } from '../modules/channel/application/handler/SyncrunsStartHandler';
import { SyncrunsReadHandler as Handler220 } from '../modules/channel/application/handler/SyncrunsReadHandler';
import { SyncrunsCancelHandler as Handler221 } from '../modules/channel/application/handler/SyncrunsCancelHandler';
import { OperationsReadHandler as Handler222 } from '../modules/channel/application/handler/OperationsReadHandler';
import { OperationsReplayHandler as Handler223 } from '../modules/channel/application/handler/OperationsReplayHandler';
import { InstallationsReadHandler as Handler224 } from '../modules/extension/application/handler/InstallationsReadHandler';
import { NavigationTreeHandler as Handler225 } from '../modules/navigation/interface/handler/NavigationTreeHandler';
import { NavigationCatalogHandler as Handler226 } from '../modules/navigation/interface/handler/NavigationCatalogHandler';
import { NavigationHealthHandler as Handler227 } from '../modules/navigation/interface/handler/NavigationHealthHandler';
import { ProvidersReadHandler as Handler228 } from '../modules/identity/interface/handler/ProvidersReadHandler';
import { FederationStartHandler as Handler229 } from '../modules/identity/interface/handler/FederationStartHandler';
import { FederationCallbackHandler as Handler230 } from '../modules/identity/interface/handler/FederationCallbackHandler';
import { MembershipSelectionReadHandler as Handler231 } from '../modules/identity/interface/handler/MembershipSelectionReadHandler';
import { FederationCompleteHandler as Handler232 } from '../modules/identity/interface/handler/FederationCompleteHandler';
import { LinksReadHandler as Handler233 } from '../modules/identity/interface/handler/LinksReadHandler';
import { LinksCreateHandler as Handler234 } from '../modules/identity/interface/handler/LinksCreateHandler';
import { LinksRevokeHandler as Handler235 } from '../modules/identity/interface/handler/LinksRevokeHandler';
import { ProvidersManageHandler as Handler236 } from '../modules/identity/interface/handler/ProvidersManageHandler';
import { ProvidersTestHandler as Handler237 } from '../modules/identity/interface/handler/ProvidersTestHandler';
import { DirectoriesReadHandler as Handler238 } from '../modules/organization/application/handler/DirectoriesReadHandler';
import { DirectoriesManageHandler as Handler239 } from '../modules/organization/application/handler/DirectoriesManageHandler';
import { DirectoriesSyncHandler as Handler240 } from '../modules/organization/application/handler/DirectoriesSyncHandler';
import { DirectorySyncrunsReadHandler as Handler241 } from '../modules/organization/application/handler/DirectorySyncrunsReadHandler';
import { DirectoryeventsReceiveHandler as Handler242 } from '../modules/organization/application/handler/DirectoryeventsReceiveHandler';
import { SettingsReadHandler as Handler243 } from '../modules/referral/application/handler/SettingsReadHandler';
import { SettingsManageHandler as Handler244 } from '../modules/referral/application/handler/SettingsManageHandler';
import { ProductsReadHandler as Handler245 } from '../modules/referral/application/handler/ProductsReadHandler';
import { ProductsManageHandler as Handler246 } from '../modules/referral/application/handler/ProductsManageHandler';
import { MembersReadHandler as Handler247 } from '../modules/referral/application/handler/MembersReadHandler';
import { MembersApplyHandler as Handler248 } from '../modules/referral/application/handler/MembersApplyHandler';
import { MembersApproveHandler as Handler249 } from '../modules/referral/application/handler/MembersApproveHandler';
import { MembersDisqualifyHandler as Handler250 } from '../modules/referral/application/handler/MembersDisqualifyHandler';
import { BindingsReadHandler as Handler251 } from '../modules/referral/application/handler/BindingsReadHandler';
import { BindingsCreateHandler as Handler252 } from '../modules/referral/application/handler/BindingsCreateHandler';
import { CommissionsReadHandler as Handler253 } from '../modules/referral/application/handler/CommissionsReadHandler';
import { EarningsReadHandler as Handler254 } from '../modules/referral/application/handler/EarningsReadHandler';
import { LinksReadHandler as Handler255 } from '../modules/referral/application/handler/LinksReadHandler';
import { WithdrawalsReadHandler as Handler256 } from '../modules/referral/application/handler/WithdrawalsReadHandler';
import { WithdrawalsCreateHandler as Handler257 } from '../modules/referral/application/handler/WithdrawalsCreateHandler';
import { PoliciesReadHandler as Handler258 } from '../modules/finance/application/handler/PoliciesReadHandler';
import { PoliciesPreviewHandler as Handler259 } from '../modules/finance/application/handler/PoliciesPreviewHandler';
import { RepairsReadHandler as Handler260 } from '../modules/finance/application/handler/RepairsReadHandler';
import { RepairsPreviewHandler as Handler261 } from '../modules/finance/application/handler/RepairsPreviewHandler';
import { RepairsSubmitHandler as Handler262 } from '../modules/finance/application/handler/RepairsSubmitHandler';
import { RepairsDecideHandler as Handler263 } from '../modules/finance/application/handler/RepairsDecideHandler';
import { RepairsReverseHandler as Handler264 } from '../modules/finance/application/handler/RepairsReverseHandler';
import { OrdersReceiveHandler as Handler265 } from '../modules/order/application/handler/OrdersReceiveHandler';
import { QuotesCurrentReadHandler as Handler266 } from '../modules/checkout/application/handler/QuotesCurrentReadHandler';
import { BootstrapReadHandler as Handler267 } from '../modules/navigation/application/handler/BootstrapReadHandler';
import { CatalogReadHandler as Handler268 } from '../modules/navigation/application/handler/CatalogReadHandler';

export const HANDLER_TYPES = new Map<OperationId, OperationHandlerType<OperationId>>([
  ["runtime.health.live", Handler0],
  ["runtime.health.ready", Handler1],
  ["runtime.health.startup", Handler2],
  ["runtime.health.dependency", Handler3],
  ["identity.sessions.create", Handler4],
  ["identity.sessions.complete", Handler5],
  ["identity.tickets.exchange", Handler6],
  ["identity.session.read", Handler7],
  ["identity.session.delete", Handler8],
  ["identity.sessions.read", Handler9],
  ["identity.sessions.revoke", Handler10],
  ["identity.memberships.read", Handler11],
  ["identity.memberships.switch", Handler12],
  ["identity.challenges.create", Handler13],
  ["identity.invitations.resolve", Handler14],
  ["identity.invitations.read", Handler15],
  ["identity.invitations.create", Handler16],
  ["identity.invitations.revoke", Handler17],
  ["identity.enrollments.read", Handler18],
  ["identity.enrollments.complete", Handler19],
  ["identity.members.manage", Handler20],
  ["identity.password.change", Handler21],
  ["identity.password.verify", Handler22],
  ["identity.password.reset", Handler23],
  ["identity.mobile.manage", Handler24],
  ["identity.stepup.start", Handler25],
  ["identity.stepup.complete", Handler26],
  ["organization.layers.read", Handler27],
  ["access.center.read", Handler28],
  ["access.owners.transfer", Handler29],
  ["access.roles.manage", Handler30],
  ["access.overrides.manage", Handler31],
  ["access.scopes.manage", Handler32],
  ["capability.assignments.read", Handler33],
  ["capability.assignments.manage", Handler34],
  ["partner.partners.read", Handler35],
  ["partner.partners.manage", Handler36],
  ["organization.stores.read", Handler37],
  ["organization.stores.manage", Handler38],
  ["member.members.read", Handler39],
  ["member.profile.read", Handler40],
  ["member.addresses.read", Handler41],
  ["member.addresses.manage", Handler42],
  ["member.favorites.read", Handler43],
  ["member.favorites.put", Handler44],
  ["member.imports.create", Handler45],
  ["member.imports.read", Handler46],
  ["qualification.center.read", Handler47],
  ["qualification.decisions.preview", Handler48],
  ["qualification.policies.manage", Handler49],
  ["channel.distributors.create", Handler50],
  ["channel.distributors.read", Handler51],
  ["channel.distributors.update", Handler52],
  ["channel.distributors.disable", Handler53],
  ["channel.bindings.manage", Handler54],
  ["channel.quotas.manage", Handler55],
  ["catalog.pools.read", Handler56],
  ["catalog.pools.attach", Handler57],
  ["catalog.pools.detach", Handler58],
  ["catalog.pools.allocate", Handler59],
  ["catalog.product.detail.read", Handler60],
  ["catalog.products.create", Handler61],
  ["catalog.products.update", Handler62],
  ["catalog.products.archive", Handler63],
  ["catalog.listings.read", Handler64],
  ["catalog.listings.publish", Handler65],
  ["catalog.listings.unpublish", Handler66],
  ["catalog.listings.batch", Handler67],
  ["catalog.imports.create", Handler68],
  ["catalog.imports.read", Handler69],
  ["pricing.rules.create", Handler70],
  ["pricing.rules.publish", Handler71],
  ["inventory.imports.create", Handler72],
  ["inventory.imports.read", Handler73],
  ["marketing.campaigns.read", Handler74],
  ["reporting.dashboard.read", Handler75],
  ["reporting.sales.read", Handler76],
  ["reporting.products.read", Handler77],
  ["reporting.malls.read", Handler78],
  ["reporting.categories.read", Handler79],
  ["reporting.channels.read", Handler80],
  ["reporting.powderclass.read", Handler81],
  ["reporting.voucherconsumption.read", Handler82],
  ["reporting.exports.create", Handler83],
  ["reporting.exports.read", Handler84],
  ["experience.applications.create", Handler85],
  ["experience.applications.copy", Handler86],
  ["experience.applications.read", Handler87],
  ["experience.applications.update", Handler88],
  ["experience.versions.save", Handler89],
  ["experience.versions.validate", Handler90],
  ["experience.versions.publish", Handler91],
  ["experience.versions.restore", Handler92],
  ["cart.current.read", Handler93],
  ["cart.items.put", Handler94],
  ["cart.items.batch", Handler95],
  ["checkout.quote.create", Handler96],
  ["order.orders.create", Handler97],
  ["order.orders.read", Handler98],
  ["order.reminders.create", Handler99],
  ["order.orders.export", Handler100],
  ["order.aftersales.read", Handler101],
  ["order.aftersales.apply", Handler102],
  ["order.aftersales.approve", Handler103],
  ["order.aftersales.reject", Handler104],
  ["fulfillment.shipments.create", Handler105],
  ["fulfillment.tracking.read", Handler106],
  ["fulfillment.returns.receive", Handler107],
  ["fulfillment.returns.inspect", Handler108],
  ["payment.intents.read", Handler109],
  ["verification.challenges.issue", Handler110],
  ["verification.sessions.read", Handler111],
  ["verification.challenges.verify", Handler112],
  ["verification.history.read", Handler113],
  ["verification.devices.read", Handler114],
  ["verification.devices.manage", Handler115],
  ["payment.refunds.request", Handler116],
  ["payment.recoveries.read", Handler117],
  ["payment.recoveries.resolve", Handler118],
  ["payment.webhooks.wechat", Handler119],
  ["voucher.cardlibraries.read", Handler120],
  ["voucher.cardlibraries.create", Handler121],
  ["voucher.cardlibraries.allocate", Handler122],
  ["voucher.imports.read", Handler123],
  ["voucher.programs.read", Handler124],
  ["voucher.programs.manage", Handler125],
  ["voucher.reserves.read", Handler126],
  ["voucher.reserves.request", Handler127],
  ["voucher.reserves.decide", Handler128],
  ["voucher.batches.read", Handler129],
  ["voucher.batches.issue", Handler130],
  ["voucher.batches.retry", Handler131],
  ["voucher.status.batch", Handler132],
  ["voucher.statusbatches.read", Handler133],
  ["voucher.bindings.read", Handler134],
  ["voucher.bindings.manage", Handler135],
  ["voucher.redemptions.read", Handler136],
  ["voucher.history.read", Handler137],
  ["voucher.redemptions.reverse", Handler138],
  ["benefit.accounts.read", Handler139],
  ["benefit.ledgers.read", Handler140],
  ["benefit.plans.read", Handler141],
  ["benefit.plans.manage", Handler142],
  ["benefit.budgets.read", Handler143],
  ["benefit.budgets.manage", Handler144],
  ["benefit.grants.create", Handler145],
  ["benefit.grants.decide", Handler146],
  ["benefit.grants.read", Handler147],
  ["benefit.grants.control", Handler148],
  ["benefit.grants.revoke", Handler149],
  ["benefit.lots.read", Handler150],
  ["finance.overview.read", Handler151],
  ["finance.entries.read", Handler152],
  ["finance.statements.read", Handler153],
  ["finance.statements.export", Handler154],
  ["finance.reconciliations.manage", Handler155],
  ["finance.reconciliations.read", Handler156],
  ["finance.settlements.read", Handler157],
  ["finance.settlements.decide", Handler158],
  ["finance.settlements.adjust", Handler159],
  ["finance.withdrawals.read", Handler160],
  ["finance.withdrawals.create", Handler161],
  ["finance.withdrawals.decide", Handler162],
  ["finance.withdrawals.recover", Handler163],
  ["finance.holds.read", Handler164],
  ["finance.periods.read", Handler165],
  ["finance.periods.manage", Handler166],
  ["finance.backfills.read", Handler167],
  ["finance.backfills.decide", Handler168],
  ["finance.policies.manage", Handler169],
  ["finance.invoices.read", Handler170],
  ["finance.invoices.download", Handler171],
  ["invoice.profiles.manage", Handler172],
  ["invoice.profiles.read", Handler173],
  ["invoice.requests.create", Handler174],
  ["invoice.requests.read", Handler175],
  ["invoice.requests.cancel", Handler176],
  ["invoice.requests.decide", Handler177],
  ["invoice.requests.red", Handler178],
  ["support.cases.create", Handler179],
  ["support.cases.read", Handler180],
  ["support.cases.update", Handler181],
  ["support.cases.close", Handler182],
  ["support.cases.reopen", Handler183],
  ["support.messages.send", Handler184],
  ["support.messages.read", Handler185],
  ["support.attachments.create", Handler186],
  ["support.assignments.manage", Handler187],
  ["support.agents.manage", Handler188],
  ["support.agents.read", Handler189],
  ["support.accounts.manage", Handler190],
  ["support.accounts.read", Handler191],
  ["support.rules.read", Handler192],
  ["support.rules.manage", Handler193],
  ["support.slas.read", Handler194],
  ["support.slas.manage", Handler195],
  ["support.history.read", Handler196],
  ["notification.notifications.read", Handler197],
  ["notification.notifications.ack", Handler198],
  ["notification.preferences.read", Handler199],
  ["notification.preferences.manage", Handler200],
  ["notification.endpoints.manage", Handler201],
  ["notification.templates.manage", Handler202],
  ["notification.templates.read", Handler203],
  ["notification.announcements.read", Handler204],
  ["notification.announcements.manage", Handler205],
  ["risk.center.read", Handler206],
  ["risk.policies.manage", Handler207],
  ["risk.cases.review", Handler208],
  ["audit.records.read", Handler209],
  ["observability.clienterrors.create", Handler210],
  ["observability.clienterrors.read", Handler211],
  ["channel.connections.read", Handler212],
  ["channel.connections.create", Handler213],
  ["channel.connections.update", Handler214],
  ["channel.connections.test", Handler215],
  ["channel.connections.enable", Handler216],
  ["channel.connections.disable", Handler217],
  ["channel.webhooks.receive", Handler218],
  ["channel.syncruns.start", Handler219],
  ["channel.syncruns.read", Handler220],
  ["channel.syncruns.cancel", Handler221],
  ["channel.operations.read", Handler222],
  ["channel.operations.replay", Handler223],
  ["extension.installations.read", Handler224],
  ["navigation.tree.read", Handler225],
  ["navigation.catalog.read", Handler226],
  ["navigation.health.read", Handler227],
  ["identity.providers.read", Handler228],
  ["identity.federations.start", Handler229],
  ["identity.federations.callback", Handler230],
  ["identity.federations.selection.read", Handler231],
  ["identity.federations.complete", Handler232],
  ["identity.links.read", Handler233],
  ["identity.links.create", Handler234],
  ["identity.links.revoke", Handler235],
  ["identity.providers.manage", Handler236],
  ["identity.providers.test", Handler237],
  ["organization.directories.read", Handler238],
  ["organization.directories.manage", Handler239],
  ["organization.directories.sync", Handler240],
  ["organization.directories.syncruns.read", Handler241],
  ["organization.directoryevents.receive", Handler242],
  ["referral.settings.read", Handler243],
  ["referral.settings.manage", Handler244],
  ["referral.products.read", Handler245],
  ["referral.products.manage", Handler246],
  ["referral.members.read", Handler247],
  ["referral.members.apply", Handler248],
  ["referral.members.approve", Handler249],
  ["referral.members.disqualify", Handler250],
  ["referral.bindings.read", Handler251],
  ["referral.bindings.create", Handler252],
  ["referral.commissions.read", Handler253],
  ["referral.earnings.read", Handler254],
  ["referral.links.read", Handler255],
  ["referral.withdrawals.read", Handler256],
  ["referral.withdrawals.create", Handler257],
  ["finance.policies.read", Handler258],
  ["finance.policies.preview", Handler259],
  ["finance.reconciliationrepairs.read", Handler260],
  ["finance.reconciliationrepairs.preview", Handler261],
  ["finance.reconciliationrepairs.submit", Handler262],
  ["finance.reconciliationrepairs.decide", Handler263],
  ["finance.reconciliationrepairs.reverse", Handler264],
  ["order.orders.receive", Handler265],
  ["checkout.quotes.current.read", Handler266],
  ["storefront.bootstrap.read", Handler267],
  ["storefront.catalog.read", Handler268],
]);
