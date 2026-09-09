import { NavigationIcon } from '@shop/design';
import type { SettingsModule } from '../model/Settings';

export function SettingsCard({ module }: Readonly<{ module: SettingsModule }>) {
  return (
    <a className="settingscard" data-visual-copy="multiline" href={module.href} aria-label={`打开${module.title}`}>
      <span className="settingsicon" aria-hidden="true">
        <NavigationIcon icon={module.icon} />
      </span>
      <span className="settingscardcopy">
        <strong>{module.title}</strong>
        <small>{module.description}</small>
      </span>
      <span className="settingsopen">
        打开 <span aria-hidden="true">→</span>
      </span>
    </a>
  );
}
