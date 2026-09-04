import type { OperationOutputFor } from '@shop/contract';
import { exactOperationOutput } from '@shop/contract/schema';

export const AccessPageDtoSchema = exactOperationOutput('AccessCenterReadOutput');
export const OwnershipDtoSchema = exactOperationOutput('AccessOwnershipReadOutput');
export const OwnershipCreatePreviewDtoSchema = exactOperationOutput('AccessOwnershipTransfersPreviewOutput');
export const OwnershipCreateDtoSchema = exactOperationOutput('AccessOwnershipTransfersCreateOutput');
export const OwnershipAcceptPreviewDtoSchema = exactOperationOutput('AccessOwnershipTransfersAcceptPreviewOutput');
export const OwnershipAcceptDtoSchema = exactOperationOutput('AccessOwnershipTransfersAcceptOutput');
export const OwnershipCancelPreviewDtoSchema = exactOperationOutput('AccessOwnershipTransfersCancelPreviewOutput');
export const OwnershipCancelDtoSchema = exactOperationOutput('AccessOwnershipTransfersCancelOutput');
export const RoleReceiptDtoSchema = exactOperationOutput('AccessRolesManageOutput');
export const OverrideReceiptDtoSchema = exactOperationOutput('AccessOverridesManageOutput');
export const ScopeReceiptDtoSchema = exactOperationOutput('AccessScopesManageOutput');

export type AccessPageDto = OperationOutputFor<'access.center.read'>;
export type OwnershipTransferDto = OperationOutputFor<'access.ownership.transfers.create'>;
export type OwnershipImpactDto = OperationOutputFor<'access.ownership.transfers.accept.preview'>['impact'];
export type OwnershipDto = OperationOutputFor<'access.ownership.read'>;
