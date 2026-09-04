// Generated from config/clients.yml. Do not edit.
export const CLIENT_SURFACES = ["auth","console","storefront","miniapp","store","supplier"] as const;
export type ClientSurface = (typeof CLIENT_SURFACES)[number];
export const OPERATION_TARGETS = ["console","storefront","miniapp","store","supplier"] as const;
export type OperationTarget = (typeof OPERATION_TARGETS)[number];
export const CONSUMER_TARGETS = ["storefront","miniapp"] as const satisfies readonly OperationTarget[];
export type ConsumerTarget = (typeof CONSUMER_TARGETS)[number];
export const OPERATOR_TARGETS = ["console","store","supplier"] as const satisfies readonly OperationTarget[];
export type OperatorTarget = (typeof OPERATOR_TARGETS)[number];
export function isClientSurface(value: unknown): value is ClientSurface { return typeof value === 'string' && (CLIENT_SURFACES as readonly string[]).includes(value); }
export function isOperationTarget(value: unknown): value is OperationTarget { return typeof value === 'string' && (OPERATION_TARGETS as readonly string[]).includes(value); }
export function isConsumerTarget(value: unknown): value is ConsumerTarget { return typeof value === 'string' && (CONSUMER_TARGETS as readonly string[]).includes(value); }
export function isOperatorTarget(value: unknown): value is OperatorTarget { return typeof value === 'string' && (OPERATOR_TARGETS as readonly string[]).includes(value); }
