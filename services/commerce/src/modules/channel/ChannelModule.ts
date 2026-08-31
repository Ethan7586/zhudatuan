import { defineModule } from '../../bootstrap/DefinedModule';
import { channelRoutes } from './interface/http/ChannelRoutes';
import { PgExtensionStateSink } from './infrastructure/persistence/PgExtensionStateSink';
import type { ExtensionStateSink } from '../extension/public/index';
import { Manifest } from './Manifest';
import { FINANCE_CHANNEL_PORT, PgFinanceChannelPort } from './public';
export { createSupplierProviderInstallation } from './infrastructure/adapter/PgSupplierProvider';
export type { CatalogSource } from './application/port/CatalogSource';
export type { PriceSource } from './application/port/PriceSource';
export type { StockSource } from './application/port/StockSource';
export type { RemoteOrderSubmitter } from './application/port/RemoteOrderSubmitter';
export type { RemoteRefundProvider } from './application/port/RemoteRefundProvider';
export type { StatementSource } from './application/port/StatementSource';
export function channelExtensionSink(): ExtensionStateSink {
  return new PgExtensionStateSink();
}
export const ChannelModule = defineModule(Manifest, channelRoutes, [{ token: FINANCE_CHANNEL_PORT, value: new PgFinanceChannelPort() }]);
