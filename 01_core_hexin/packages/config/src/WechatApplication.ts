export type WechatScene = 'miniapp' | 'jsapi';

export interface WechatApplication {
  readonly scene: WechatScene;
  readonly appId: string;
}

export class WechatApplicationCatalog {
  private readonly applications: ReadonlyMap<WechatScene, WechatApplication>;

  private constructor(applications: readonly WechatApplication[]) {
    this.applications = new Map(applications.map((application) => [application.scene, application]));
    Object.freeze(this);
  }

  static parse(value: unknown): WechatApplicationCatalog {
    const source = object(value, 'WECHAT_APPLICATION_CONFIG_INVALID');
    exactKeys(source, ['applications'], 'WECHAT_APPLICATION_CONFIG_INVALID');
    if (!Array.isArray(source.applications) || source.applications.length !== 2) invalid();
    const applications = source.applications.map((candidate) => parseApplication(candidate));
    const scenes = new Set(applications.map((application) => application.scene));
    const appIds = new Set(applications.map((application) => application.appId));
    if (scenes.size !== 2 || !scenes.has('miniapp') || !scenes.has('jsapi') || appIds.size !== 2) invalid();
    return new WechatApplicationCatalog(applications);
  }

  get(scene: WechatScene): WechatApplication {
    const application = this.applications.get(scene);
    if (!application) invalid();
    return application;
  }

  find(appId: string): WechatApplication | undefined {
    return [...this.applications.values()].find((application) => application.appId === appId);
  }

  all(): readonly WechatApplication[] {
    return Object.freeze([...this.applications.values()]);
  }
}

function parseApplication(value: unknown): WechatApplication {
  const source = object(value, 'WECHAT_APPLICATION_CONFIG_INVALID');
  exactKeys(source, ['appId', 'scene'], 'WECHAT_APPLICATION_CONFIG_INVALID');
  if ((source.scene !== 'miniapp' && source.scene !== 'jsapi') || typeof source.appId !== 'string'
    || !/^wx[A-Za-z0-9]{16}$/.test(source.appId)) invalid();
  return Object.freeze({ scene: source.scene, appId: source.appId });
}

function object(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

function exactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[], code: string): void {
  if (Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) throw new Error(code);
}

function invalid(): never {
  throw new Error('WECHAT_APPLICATION_CONFIG_INVALID');
}
