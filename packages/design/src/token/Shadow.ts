import { token } from './Token';

export const shadow = token.depth;
export type ShadowToken = keyof typeof shadow;
