export interface SettingsModule {
  readonly id: string;
  readonly title: string;
  readonly component: string;
  readonly icon: string;
  readonly description: string;
  readonly href: string;
}

export interface SettingsGroup {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly modules: readonly SettingsModule[];
}

export interface SettingsWorkspace {
  readonly groups: readonly SettingsGroup[];
  readonly moduleCount: number;
  readonly assurance: string;
  readonly scope: string;
}
