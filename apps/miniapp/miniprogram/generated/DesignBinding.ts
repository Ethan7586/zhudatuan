// Generated from packages/design/src/tokens.json and config/visuals.yml. Do not edit.
export const MINIAPP_VIEW_STATES = Object.freeze(["loading","empty","error","forbidden","expired","partial","success"] as const);
export const MINIAPP_RESOURCE_STATES = Object.freeze(["loading","refreshing","empty","error","forbidden","expired","unavailable","notconfigured","notfound","conflict","offline","running","partial","success"] as const);
export const MINIAPP_TOKEN = Object.freeze({ brand: '#1F5EFF', minimumTouchRpx: 88, version: '1.2.0' } as const);
export type MiniappViewState = (typeof MINIAPP_VIEW_STATES)[number];
export type MiniappResourceState = (typeof MINIAPP_RESOURCE_STATES)[number];
