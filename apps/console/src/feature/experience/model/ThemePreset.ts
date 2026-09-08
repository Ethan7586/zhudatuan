import { easternGallery, quietOrder, warmWorkshop, type ExperienceTheme } from '@shop/design';
import type { MallTheme, ThemePresetId } from './Mall';

export interface ThemePreset {
  readonly id: ThemePresetId;
  readonly name: string;
  readonly temperament: string;
  readonly description: string;
  readonly theme: MallTheme;
  readonly visual: Readonly<{ surface: string; radius: string; headingFont: string; sectionGap: string }>;
}

export const themePresets: readonly ThemePreset[] = Object.freeze([
  preset(quietOrder),
  preset(easternGallery),
  preset(warmWorkshop),
]);

export function themePreset(id: ThemePresetId): ThemePreset {
  const preset = themePresets.find((candidate) => candidate.id === id);
  if (!preset) throw new Error('THEME_PRESET_INVALID');
  return preset;
}

function preset(source: ExperienceTheme & Readonly<{ id: ThemePresetId }>): ThemePreset {
  return Object.freeze({
    id: source.id,
    name: source.name,
    temperament: source.temperament,
    description: source.description,
    theme: Object.freeze({ preset: source.id, primaryColor: source.primary, accentColor: source.accent, logoObjectRef: null, faviconObjectRef: null }),
    visual: Object.freeze({ surface: source.surface, radius: source.radius, headingFont: source.headingFont, sectionGap: source.sectionGap }),
  });
}
