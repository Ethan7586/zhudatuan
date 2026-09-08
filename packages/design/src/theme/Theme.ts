import { token, type Token } from '../token/Token';
import { easternGallery } from './EasternGallery';
import { quietOrder } from './QuietOrder';
import { smartWing, type ExperienceTheme } from './SmartWing';
import { warmWorkshop } from './WarmWorkshop';

export interface Theme {
  readonly name: 'default';
  readonly token: Token;
}

export const theme: Theme = Object.freeze({ name: 'default', token });

export const experienceThemes: readonly ExperienceTheme[] = Object.freeze([smartWing, quietOrder, easternGallery, warmWorkshop]);

export function experienceTheme(id: ExperienceTheme['id']): ExperienceTheme {
  const selected = experienceThemes.find((candidate) => candidate.id === id);
  if (!selected) throw new Error('EXPERIENCE_THEME_INVALID');
  return selected;
}
