import { token } from './Token';

export const layer = token.layer;
export type LayerToken = keyof typeof layer;
