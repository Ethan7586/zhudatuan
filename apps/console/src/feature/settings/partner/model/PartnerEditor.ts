import type { Partner, PartnerKind, PartnerStatus } from './Partner';
import type { Store } from './Store';

export type PartnerSection = PartnerKind | 'store' | 'customer';
export type PartnerSelection = Readonly<{ kind: 'partner'; value: Partner }> | Readonly<{ kind: 'store'; value: Store }>;
export interface PartnerEditor {
  readonly kind: 'partner';
  readonly original?: Partner;
  readonly id: string;
  readonly partnerKind: PartnerKind;
  readonly name: string;
  readonly status: PartnerStatus;
}
export interface StoreEditor {
  readonly kind: 'store';
  readonly original?: Store;
  readonly id: string;
  readonly name: string;
  readonly status: PartnerStatus;
  readonly mallId: string;
  readonly regionCode: string;
  readonly radius: string;
  readonly addressMode: 'preserve' | 'replace' | 'remove';
  readonly address: string;
}
export type PartnerEditorState = PartnerEditor | StoreEditor;

export function partnerSection(value: string | null): PartnerSection {
  return value === 'brand' || value === 'store' || value === 'customer' ? value : 'supplier';
}
export function serviceRadius(value: string): number | null {
  return value.trim() ? Number(value) : null;
}

export function validatePartnerEditor(editor?: PartnerEditorState): string | undefined {
  if (editor === undefined) return undefined;
  if (editor.name.trim().length < 2 || editor.name.trim().length > 160) return '名称需为 2 至 160 个字符。';
  if (editor.kind === 'partner') {
    if (editor.original && editor.name.trim() === editor.original.name && editor.status === editor.original.status) return '请先修改名称或状态。';
    return undefined;
  }
  if (!/^[A-Za-z0-9.-]{2,32}$/.test(editor.regionCode.trim())) return '区域编码需为 2 至 32 位字母、数字、点或短横线。';
  if (editor.radius.trim() && (!Number.isInteger(Number(editor.radius)) || Number(editor.radius) < 1 || Number(editor.radius) > 1_000_000)) return '服务半径需为 1 至 1,000,000 米的整数。';
  if (editor.addressMode === 'replace' && (editor.address.trim().length < 4 || editor.address.trim().length > 1000)) return '新地址需为 4 至 1000 个字符。';
  if (
    editor.original &&
    editor.name.trim() === editor.original.name &&
    editor.status === editor.original.status &&
    (editor.mallId.trim() || null) === editor.original.mallId &&
    editor.regionCode.trim() === editor.original.regionCode &&
    serviceRadius(editor.radius) === editor.original.serviceRadiusMeters &&
    editor.addressMode === 'preserve'
  )
    return '请先修改门店资料、地址或状态。';
  return undefined;
}
