import { defineModule } from '../../../bootstrap/DefinedModule';
import { channelRoutes } from './http/ChannelRoutes';
import { PgExtensionStateSink } from '../04_adapters_shixian/persistence/PgExtensionStateSink';
import type { ExtensionStateSink } from '../../extension';
export { createPrivateProviderInstallation } from '../04_adapters_shixian/adapter/PgPrivateProvider';
export type { CatalogSource } from '../01_public_gongkai/CatalogSource';
export type { PriceSource } from '../01_public_gongkai/PriceSource';
export type { StockSource } from '../01_public_gongkai/StockSource';
export type { RemoteOrderSubmitter } from '../01_public_gongkai/RemoteOrderSubmitter';
export type { RemoteRefundProvider } from '../01_public_gongkai/RemoteRefundProvider';
export type { StatementSource } from '../01_public_gongkai/StatementSource';
export function channelExtensionSink():ExtensionStateSink { return new PgExtensionStateSink(); }
export { ChannelOperationPort, channelOperationPort, type ProviderOperationInput } from '../01_public_gongkai/ChannelOperationPort';
export const ChannelModule = defineModule('channel', ['extension', 'catalog', 'inventory', 'fulfillment', 'finance'], channelRoutes);
