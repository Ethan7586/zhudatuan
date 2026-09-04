import { exactOperationOutput } from '@shop/contract/schema';

export const PlatformPageSchema = exactOperationOutput('OrganizationLayersReadOutput');
export const DistributionPageSchema = exactOperationOutput('ChannelDistributorsReadOutput');
export const RuntimeHealthSchema = exactOperationOutput('RuntimeHealthDependencyOutput');

export interface PlatformPageDto {
  readonly items: readonly Readonly<{ id: string; kind: string; parent_id: string | null; parent_name: string | null; name: string; timezone: string; status: 'draft' | 'active' | 'disabled'; version: number }>[];
  readonly count: number;
  readonly nextCursor?: string;
}
