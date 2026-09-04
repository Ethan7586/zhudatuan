import { navigateMiniapp, type MiniappNavigationItem } from '../runtime/Navigation';
import type { MembershipChoice, MiniappRuntime } from '../runtime/MiniappRuntime';
import { routeFromOptions } from '../runtime/DeepLink';
import { readMiniappRoute } from '../generated/PageBinding';
import type { RouteId, RouteMatch } from '../generated/RouteBinding';
import type { MiniappInstance } from '../platform/Wechat';
import type { MiniappFeatureViewModel } from '../shared/FeatureViewModel';

interface DisplayRow {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  readonly status: string;
  readonly timestamp: string;
}

interface PageData {
  readonly title: string;
  readonly description: string;
  readonly state: 'loading' | 'ready' | 'empty' | 'error' | 'selection';
  readonly rows: readonly DisplayRow[];
  readonly count: number;
  readonly error: string;
  readonly stale: boolean;
  readonly authenticated: boolean;
  readonly navigation: readonly MiniappNavigationItem[];
  readonly memberships: readonly MembershipChoice[];
}

interface PageMethods {
  route?: RouteMatch;
  active?: AbortController;
  onLoad(options: Readonly<Record<string, string | undefined>>): void;
  onUnload(): void;
  onPullDownRefresh(): void;
  onRetry(): void;
  onSignIn(): void;
  onSignOut(): void;
  onSelectMembership(event: unknown): void;
  onNavigate(event: unknown): void;
  load(): Promise<void>;
}

const initial: PageData = Object.freeze({
  title: '智慧翼福利商城',
  description: '正在加载商城信息。',
  state: 'loading',
  rows: Object.freeze([]),
  count: 0,
  error: '',
  stale: false,
  authenticated: false,
  navigation: Object.freeze([]),
  memberships: Object.freeze([]),
});

export function registerFeaturePage(feature: MiniappFeatureViewModel): void {
  Page<PageData, PageMethods>({
    data: initial,
    onLoad(options) {
      try {
        const route = routeFromOptions(options, readMiniappRoute({ ...options, route: options.route ?? feature.defaultRoute }));
        if (!feature.routes.includes(route.id)) throw new Error('MINIAPP_PAGE_ROUTE_DENIED');
        this.route = route;
        void this.load();
      } catch (cause) {
        this.setData({ state: 'error', error: safeMessage(cause) });
      }
    },
    onUnload() {
      this.active?.abort(new Error('PAGE_UNLOADED'));
    },
    onPullDownRefresh() {
      void this.load().finally(() => wx.stopPullDownRefresh());
    },
    onRetry() {
      void this.load();
    },
    onSignIn() {
      const runtime = currentRuntime();
      this.setData({ state: 'loading', error: '', memberships: Object.freeze([]) });
      void runtime
        .signIn()
        .then((result) => {
          if (result.kind === 'selection') this.setData({ state: 'selection', memberships: result.memberships });
          else void this.load();
        })
        .catch((cause: unknown) => this.setData({ state: 'error', error: safeMessage(cause) }));
    },
    onSignOut() {
      this.setData({ state: 'loading', error: '' });
      void currentRuntime()
        .signOut()
        .then(() => this.load())
        .catch((cause: unknown) => this.setData({ state: 'error', error: safeMessage(cause) }));
    },
    onSelectMembership(event) {
      const id = eventDetail(event, 'id');
      this.setData({ state: 'loading', error: '' });
      void currentRuntime()
        .selectMembership(id)
        .then(() => this.load())
        .catch((cause: unknown) => this.setData({ state: 'error', error: safeMessage(cause) }));
    },
    onNavigate(event) {
      navigateMiniapp(eventDetail(event, 'path'));
    },
    async load() {
      const route = this.route;
      if (route === undefined) return;
      this.active?.abort(new Error('REQUEST_REPLACED'));
      const active = new AbortController();
      this.active = active;
      this.setData({ state: 'loading', error: '', memberships: Object.freeze([]) });
      try {
        const value = await currentRuntime().read(route, active.signal);
        if (active.signal.aborted) return;
        wx.setNavigationBarTitle({ title: value.title });
        this.setData({
          title: value.title,
          description: value.description,
          state: value.data.rows.length === 0 ? 'empty' : 'ready',
          rows: value.data.rows,
          count: value.data.count,
          stale: value.stale,
          authenticated: value.authenticated,
          navigation: value.navigation,
        });
      } catch (cause) {
        if (active.signal.aborted) return;
        const failure = currentRuntime().failure(cause);
        this.setData({ state: 'error', error: failure.authenticationRequired ? '登录后即可查看这项内容。' : failure.message, authenticated: false, stale: false });
      }
    },
  });
}

function currentRuntime(): MiniappRuntime {
  const application = getApp<MiniappInstance>();
  if (application.runtime !== undefined) return application.runtime;
  throw application.startupError ?? new Error('MINIAPP_RUNTIME_UNAVAILABLE');
}

function eventDetail(event: unknown, key: string): string {
  if (event === null || typeof event !== 'object') throw new Error('MINIAPP_EVENT_INVALID');
  const detail = Reflect.get(event, 'detail');
  if (detail === null || typeof detail !== 'object') throw new Error('MINIAPP_EVENT_INVALID');
  const value = Reflect.get(detail, key);
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) throw new Error('MINIAPP_EVENT_INVALID');
  return value;
}

function safeMessage(cause: unknown): string {
  try {
    return currentRuntime().failure(cause).message;
  } catch {
    return '系统暂时无法完成操作，请检查小程序配置后重试。';
  }
}
