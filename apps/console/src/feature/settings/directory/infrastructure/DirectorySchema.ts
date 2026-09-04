import type { OperationOutputFor } from '@shop/contract';
import { exactOperationOutput } from '@shop/contract/schema';

export const DirectoryPageDtoSchema = exactOperationOutput('OrganizationDirectoriesReadOutput');
export const SyncRunPageDtoSchema = exactOperationOutput('OrganizationDirectoriesSyncrunsReadOutput');
export const SyncReceiptDtoSchema = exactOperationOutput('OrganizationDirectoriesSyncOutput');

export type DirectoryDto = OperationOutputFor<'organization.directories.read'>['items'][number];
export type SyncRunDto = OperationOutputFor<'organization.directories.syncruns.read'>['items'][number];
