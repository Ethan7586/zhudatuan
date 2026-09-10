import { requiredValue } from './Environment';

export function absoluteDirectory(value: string | undefined, code: string): string {
  const selected = requiredValue(value, code).replace(/\/+$/, '');
  if (!/^\/[A-Za-z0-9._/-]+$/.test(selected) || selected.includes('//') || /(?:^|\/)\.\.?(?:\/|$)/.test(selected)) throw new Error(code);
  return selected;
}
