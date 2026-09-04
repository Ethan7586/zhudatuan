import type { ReferralSetting } from '../model/Referral';

export interface SettingsViewModel {
  readonly kind: 'settings';
  readonly rows: readonly ReferralSetting[];
  readonly canManage: boolean;
  readonly manage: (item: ReferralSetting) => void;
}
export function settingsViewModel(rows: readonly ReferralSetting[], canManage: boolean, manage: (item: ReferralSetting) => void): SettingsViewModel {
  return Object.freeze({ kind: 'settings', rows, canManage, manage });
}
