export interface SettingsModule {
  readonly id: string;
  readonly title: string;
  readonly component: string;
  readonly href: string;
}

export interface SettingsWorkspace {
  readonly modules: readonly SettingsModule[];
  readonly assurance: string;
  readonly scope: string;
}
