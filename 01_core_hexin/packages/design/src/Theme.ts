import { token, type Token } from './Token';

export interface Theme {
  readonly name: 'default';
  readonly token: Token;
}

export const theme: Theme = Object.freeze({ name: 'default', token });
