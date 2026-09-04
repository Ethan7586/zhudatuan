import { defineModule } from '../../bootstrap/DefinedModule';
import { channelRoutes } from './interface/http/ChannelRoutes';
import { PgExtensionStateSink } from './infrastructure/persistence/PgExtensionStateSink';
import type { ExtensionStateSink } from '../extension/ExtensionModule';
export { createPrivateProviderInstallation } from './infrastructure/adapter/PgPrivateProvider';
export type { CatalogSource } from './application/port/CatalogSource';
export type { PriceSource } from './application/port/PriceSource';
export type { StockSource } from './application/port/StockSource';
export type { RemoteOrderSubmitter } from './application/port/RemoteOrderSubmitter';
export type { RemoteRefundProvider } from './application/port/RemoteRefundProvider';
export type { StatementSource } from './application/port/StatementSource';
export function channelExtensionSink():ExtensionStateSink { return new PgExtensionStateSink(); }
export { ChannelOperationPort, channelOperationPort, type ProviderOperationInput } from './ChannelOperationPort';
export const ChannelModule = defineModule('channel', ['extension', 'catalog', 'inventory', 'fulfillment', 'finance'], channelRoutes);
