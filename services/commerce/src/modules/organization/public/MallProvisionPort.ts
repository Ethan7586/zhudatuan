import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';

export interface MallProvisionSnapshot {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly publicSlug: string;
  readonly brandName: string;
  readonly domain: Readonly<{ mode: 'platform' }> | Readonly<{ mode: 'custom'; customDomain: string }>;
  readonly timezone: string;
  readonly currency: string;
  readonly theme: Readonly<{ preset: 'shop' | 'market' | 'governance'; primaryColor: string; accentColor: string; logoObjectRef: string | null; faviconObjectRef: string | null }>;
  readonly status: 'draft' | 'active' | 'disabled';
  readonly version: number;
}

export interface MallProvisionPort {
  mall(context: ReadTransactionContext, mall: string, minimumVersion: number): Promise<MallProvisionSnapshot | null>;
  malls(context: ReadTransactionContext, malls: readonly string[]): Promise<readonly MallProvisionSnapshot[]>;
}

export const MALL_PROVISION_PORT = publicPort<MallProvisionPort>('organization', 'mallprovision');
