import type { OperationBodyFor, OperationOutputFor } from '@shop/contract';
import type { DeepReadonly } from '../../../shared/model/Immutable';

type MallCreateBody = DeepReadonly<OperationBodyFor<'OrganizationMallsCreateInput'>>;
type MallLayerDto = OperationOutputFor<'organization.layers.read'>['items'][number];

export type MallRecord = DeepReadonly<OperationOutputFor<'organization.malls.read'>>;
export type ThemePresetId = MallRecord['theme']['preset'];
export type MallTheme = MallCreateBody['theme'];
export type MallOpening = MallCreateBody['opening'];
export type MallOpeningRecord = MallRecord['opening'];
export type MallCreateDraft = MallCreateBody & Readonly<{ parentVersion: number }>;
export type MallUpdateDraft = Readonly<
  Pick<MallCreateBody, 'name' | 'brandName' | 'domain' | 'ownerMembershipId' | 'timezone' | 'currency' | 'theme' | 'opening'> &
  Pick<MallRecord, 'status'>
>;

export interface MallParent {
  readonly id: string;
  readonly kind: MallLayerDto['kind'];
  readonly parentId: string | null;
  readonly name: string;
  readonly timezone: string;
  readonly version: number;
}

export interface MallParentPage {
  readonly items: readonly MallParent[];
  readonly count: number;
}

export interface MallReceipt {
  readonly requestId: string;
  readonly action: 'created' | 'updated';
  readonly mall: MallRecord;
  readonly application: 'ready' | 'initializing';
}
