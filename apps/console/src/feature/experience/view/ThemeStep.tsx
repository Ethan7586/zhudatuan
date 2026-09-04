import type { CSSProperties } from 'react';
import { themePresets } from '../model/ThemePreset';
import type { MallCreationViewModel } from '../viewmodel/MallCreationViewModel';
import { JourneyText } from './JourneyField';

export function ThemeStep({ model }: Readonly<{ model: MallCreationViewModel }>) {
  return (
    <section className="malljourneystep" aria-labelledby="mallthemestep">
      <header>
        <p>第一步</p>
        <h3 id="mallthemestep">选择品牌气质</h3>
        <span>一次比较 3 个候选；流程、组件和发布规则完全一致。</span>
      </header>
      <div className="mallthemecards">
        {themePresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            data-selected={model.draft.themePreset === preset.id}
            onClick={() => model.actions.theme(preset.id)}
            style={{ '--mall-primary': preset.theme.primaryColor, '--mall-accent': preset.theme.accentColor } as CSSProperties}
          >
            <i aria-hidden="true">
              <b />
              <b />
              <b />
            </i>
            <small>{preset.temperament}</small>
            <strong>{preset.name}</strong>
            <span>{preset.description}</span>
          </button>
        ))}
      </div>
      <div className="malljourneygrid malljourneygridcompact">
        <JourneyText label="主品牌色" field="primaryColor" value={model.draft.primaryColor} onChange={model.actions.change} pattern="#[0-9A-Fa-f]{6}" maxLength={7} />
        <JourneyText label="强调色" field="accentColor" value={model.draft.accentColor} onChange={model.actions.change} pattern="#[0-9A-Fa-f]{6}" maxLength={7} />
      </div>
    </section>
  );
}
