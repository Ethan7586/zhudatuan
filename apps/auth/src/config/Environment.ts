import { authClientEnvironment } from '@shop/config/client';

export const environment = authClientEnvironment();
export type AuthEnvironment = typeof environment;
