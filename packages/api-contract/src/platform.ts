export const CLIENT_PLATFORM = {
  web: 'web',
  wechatMiniapp: 'wechat-miniapp',
  harmonyos: 'harmonyos',
  ios: 'ios',
  android: 'android',
} as const;

export type ClientPlatform = (typeof CLIENT_PLATFORM)[keyof typeof CLIENT_PLATFORM];

/** Web and WeChat miniapp are the mandatory delivery pair for the current MVP. */
export const REQUIRED_DELIVERY_PLATFORMS = [CLIENT_PLATFORM.web, CLIENT_PLATFORM.wechatMiniapp] as const;

/** These clients are not implemented yet, but every shared contract must remain usable by them. */
export const RESERVED_DELIVERY_PLATFORMS = [CLIENT_PLATFORM.harmonyos, CLIENT_PLATFORM.ios, CLIENT_PLATFORM.android] as const;

export type ConsistencyMode = 'authoritative-command' | 'strong-read' | 'eventual-read' | 'tracked-async';
export type AsyncOperationState = 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export interface ResponseMeta {
  requestId: string;
  updatedAt: string;
  projectionVersion?: string;
}

export interface AsyncOperation<T = unknown> {
  operationId: string;
  state: AsyncOperationState;
  retryAfterMs?: number;
  result?: T;
  error?: { code: string; message: string };
  meta: ResponseMeta;
}

export interface PlatformCredential {
  platform: ClientPlatform;
  credentialType: string;
  credential: string;
}

export interface ClientPaymentInvocation {
  actionId: string;
  provider: string;
  expiresAt: string;
  parameters: Readonly<Record<string, unknown>>;
}

export interface PlatformIdentityAdapter {
  acquireCredential(): Promise<PlatformCredential>;
}

export interface PlatformPaymentAdapter {
  invokePayment(input: ClientPaymentInvocation): Promise<{ clientAccepted: boolean }>;
}

export interface PlatformStorageAdapter {
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface PlatformShareAdapter {
  share(input: { title: string; path: string; imageUrl?: string }): Promise<void>;
  copyText(text: string): Promise<void>;
}

export interface PlatformNavigationAdapter {
  open(path: string): Promise<void>;
  replace(path: string): Promise<void>;
  back(): Promise<void>;
}

export interface PlatformLifecycleAdapter {
  onForeground(listener: () => void): () => void;
  onBackground(listener: () => void): () => void;
  onNetworkChange(listener: (online: boolean) => void): () => void;
}

export interface PlatformTelemetryAdapter {
  event(name: string, attributes?: Readonly<Record<string, string | number | boolean>>): void;
  error(error: unknown, context?: Readonly<Record<string, string>>): void;
}

/** Platform implementations stay thin; domain decisions remain in Commerce API. */
export interface CommercePlatformAdapters {
  platform: ClientPlatform;
  identity: PlatformIdentityAdapter;
  payment: PlatformPaymentAdapter;
  storage: PlatformStorageAdapter;
  share: PlatformShareAdapter;
  navigation: PlatformNavigationAdapter;
  lifecycle: PlatformLifecycleAdapter;
  telemetry: PlatformTelemetryAdapter;
}
