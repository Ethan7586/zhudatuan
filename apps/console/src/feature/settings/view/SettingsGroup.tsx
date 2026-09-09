import type { SettingsGroup as SettingsGroupModel } from '../model/Settings';
import { SettingsCard } from './SettingsCard';

export function SettingsGroup({ group }: Readonly<{ group: SettingsGroupModel }>) {
  return (
    <section className="settingsgroup" aria-labelledby={`settingsgroup-${group.id}`}>
      <header>
        <div>
          <h2 id={`settingsgroup-${group.id}`}>{group.title}</h2>
          <span>{group.modules.length} 项</span>
        </div>
        <p>{group.description}</p>
      </header>
      <div className="settingsgrid">
        {group.modules.map((module) => (
          <SettingsCard key={module.id} module={module} />
        ))}
      </div>
    </section>
  );
}
