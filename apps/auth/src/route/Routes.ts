export const ROUTES = Object.freeze({ login: '/', invitation: '/invitation', membership: '/membership', callback: '/callback', link: '/link' } as const);
export type AuthRoute = (typeof ROUTES)[keyof typeof ROUTES];
