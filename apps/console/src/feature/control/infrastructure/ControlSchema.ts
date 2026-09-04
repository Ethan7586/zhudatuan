import { exactOperationOutput } from '@shop/contract/schema';
import type { OperationOutputFor } from '@shop/contract';

export const PlatformPageSchema = exactOperationOutput('OrganizationLayersReadOutput');
export const DistributionPageSchema = exactOperationOutput('ChannelDistributorsReadOutput');
export const RuntimeHealthSchema = exactOperationOutput('RuntimeHealthDependencyOutput');
export const CapabilityPageSchema = exactOperationOutput('CapabilityAssignmentsReadOutput');
export const ExtensionPageSchema = exactOperationOutput('ExtensionInstallationsReadOutput');
export const RiskPageSchema = exactOperationOutput('RiskCenterReadOutput');
export const ObservabilityHealthSchema = exactOperationOutput('ObservabilityHealthoverviewReadOutput');
export const ServiceLevelSchema = exactOperationOutput('ObservabilitySloReadOutput');

export type PlatformPageDto = OperationOutputFor<'organization.layers.read'>;
