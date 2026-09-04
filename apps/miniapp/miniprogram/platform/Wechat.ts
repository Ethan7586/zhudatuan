export interface WechatResponse {
  readonly statusCode: number;
  readonly header: Readonly<Record<string, string>>;
  readonly data: unknown;
}

export interface WechatRequestOptions {
  readonly url: string;
  readonly method: string;
  readonly header: Readonly<Record<string, string>>;
  readonly data?: string;
  readonly success: (response: WechatResponse) => void;
  readonly fail: (cause: unknown) => void;
}

export interface WechatTask {
  abort(): void;
}

export interface WechatApi {
  request(options: WechatRequestOptions): WechatTask;
  login(options: Readonly<{ success: (value: Readonly<{ code: string }>) => void; fail: (cause: unknown) => void }>): void;
  getRandomValues(options: Readonly<{ length: number; success: (value: Readonly<{ randomValues: ArrayBuffer }>) => void; fail: (cause: unknown) => void }>): void;
  getExtConfigSync(): Readonly<{ extConfig?: Readonly<Record<string, unknown>> }>;
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
  removeStorageSync(key: string): void;
  navigateTo(options: Readonly<{ url: string; fail?: (cause: unknown) => void }>): void;
  redirectTo(options: Readonly<{ url: string; fail?: (cause: unknown) => void }>): void;
  setNavigationBarTitle(options: Readonly<{ title: string }>): void;
  stopPullDownRefresh(): void;
}

export interface MiniappInstance {
  readonly runtime?: import('../runtime/MiniappRuntime').MiniappRuntime;
  readonly startupError?: unknown;
}

export interface PageInstance<TData extends object> {
  readonly data: TData;
  setData(value: Partial<TData>): void;
}

declare global {
  const wx: WechatApi;
  function App<T extends object>(options: T & ThisType<T>): void;
  function Page<TData extends object, TMethods extends object>(options: Readonly<{ data: TData }> & TMethods & ThisType<PageInstance<TData> & TMethods>): void;
  function Component<T extends object>(options: T & ThisType<T & Readonly<{ triggerEvent(name: string, detail?: unknown): void }>>): void;
  function getApp<T extends object>(): T;
}

export {};
