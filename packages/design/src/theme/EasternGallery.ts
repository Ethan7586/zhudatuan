import type { ExperienceTheme } from './SmartWing';

export const easternGallery = Object.freeze({
  id: 'market',
  name: '东方策展',
  temperament: '东方 · 策展 · 节奏',
  description: '适合地方好物、节庆专题与品牌精选。',
  primary: '#A23B32',
  accent: '#C99A45',
  surface: '#FAF5EC',
  radius: '3px',
  headingFont: 'ui-serif, STSong, serif',
  sectionGap: '30px',
} as const satisfies ExperienceTheme);
