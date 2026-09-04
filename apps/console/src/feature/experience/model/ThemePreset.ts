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
  Object.freeze({
    id: 'shop',
    name: '静序',
    temperament: '克制 · 秩序 · 留白',
    description: '适合员工福利、标准商城与高频选购。',
    theme: Object.freeze({ preset: 'shop', primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null }),
    visual: Object.freeze({ surface: '#F7F8FA', radius: '12px', headingFont: 'var(--sw-font-family)', sectionGap: '24px' }),
  }),
  Object.freeze({
    id: 'market',
    name: '东方策展',
    temperament: '东方 · 策展 · 节奏',
    description: '适合地方好物、节庆专题与品牌精选。',
    theme: Object.freeze({ preset: 'market', primaryColor: '#A23B32', accentColor: '#C99A45', logoObjectRef: null, faviconObjectRef: null }),
    visual: Object.freeze({ surface: '#FAF5EC', radius: '3px', headingFont: 'ui-serif, STSong, serif', sectionGap: '30px' }),
  }),
  Object.freeze({
    id: 'governance',
    name: '暖筑工坊',
    temperament: '温暖 · 模块 · 亲和',
    description: '适合政企关怀、工会福利与长期运营。',
    theme: Object.freeze({ preset: 'governance', primaryColor: '#E8502A', accentColor: '#F2A65A', logoObjectRef: null, faviconObjectRef: null }),
    visual: Object.freeze({ surface: '#FFF7ED', radius: '18px', headingFont: 'var(--sw-font-family)', sectionGap: '20px' }),
  }),
]);

export function themePreset(id: ThemePresetId): ThemePreset {
  const preset = themePresets.find((candidate) => candidate.id === id);
  if (!preset) throw new Error('THEME_PRESET_INVALID');
  return preset;
}
