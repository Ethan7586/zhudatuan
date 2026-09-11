import { appConfig } from './AppConfig';

declare const __SHOP_BUILD_COMMIT__: string;
declare const __SHOP_BUILD_BRANCH__: string;
declare const __SHOP_BUILD_ID__: string;
declare const __SHOP_BUILD_DIRTY__: boolean;
declare const __SHOP_BUILD_AT__: string;

export interface BuildInfo {
  readonly commit: string;
  readonly branch: string;
  readonly id: string;
  readonly dirty: boolean;
  readonly builtAt: string;
  readonly database: string;
  readonly apiOrigin: string;
  readonly footerLabel: string;
  readonly detailLabel: string;
}

interface BuildInfoSource {
  readonly commit?: string | undefined;
  readonly branch?: string | undefined;
  readonly id?: string | undefined;
  readonly dirty?: boolean | undefined;
  readonly builtAt?: string | undefined;
  readonly database?: string | undefined;
  readonly apiOrigin?: string | undefined;
}

export function resolveBuildInfo(source: BuildInfoSource): BuildInfo {
  const commit = text(source.commit, 'unknown');
  const branch = text(source.branch, 'detached');
  const dirty = source.dirty ?? false;
  const id = text(source.id, `${commit.slice(0, 12)}${dirty ? '-dirty' : ''}`);
  const builtAt = text(source.builtAt, 'unknown');
  const database = text(source.database, '未绑定');
  const apiOrigin = text(source.apiOrigin, '未绑定');
  return Object.freeze({
    commit,
    branch,
    id,
    dirty,
    builtAt,
    database,
    apiOrigin,
    footerLabel: `Build ${id} · DB ${database}`,
    detailLabel: `commit=${commit} branch=${branch} builtAt=${builtAt} api=${apiOrigin} database=${database} dirty=${dirty}`,
  });
}

export const buildInfo = resolveBuildInfo({
  commit: typeof __SHOP_BUILD_COMMIT__ === 'string' ? __SHOP_BUILD_COMMIT__ : undefined,
  branch: typeof __SHOP_BUILD_BRANCH__ === 'string' ? __SHOP_BUILD_BRANCH__ : undefined,
  id: typeof __SHOP_BUILD_ID__ === 'string' ? __SHOP_BUILD_ID__ : undefined,
  dirty: typeof __SHOP_BUILD_DIRTY__ === 'boolean' ? __SHOP_BUILD_DIRTY__ : undefined,
  builtAt: typeof __SHOP_BUILD_AT__ === 'string' ? __SHOP_BUILD_AT__ : undefined,
  database: import.meta.env.VITE_DATABASE_ID,
  apiOrigin: appConfig.apiBaseUrl,
});

function text(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}
