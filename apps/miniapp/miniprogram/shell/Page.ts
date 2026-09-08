import { navigateMiniapp, type MiniappNavigationItem } from '../runtime/Navigation';
import type { MembershipChoice, MiniappRuntime, MiniappSnapshot } from '../runtime/MiniappRuntime';
import { routeFromOptions } from '../runtime/DeepLink';
import { readMiniappRoute } from '../generated/PageBinding';
import { miniappPagePath } from '../generated/PageBinding';
import type { RouteId, RouteMatch } from '../generated/RouteBinding';
import type { MiniappInstance, PageInstance } from '../platform/Wechat';
import type { MiniappFeatureViewModel } from '../shared/FeatureViewModel';
import type { MiniappAction } from '@shop/presentation/actions';
import type { MiniappViewState } from '../generated/DesignBinding';

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
  readonly state: MiniappViewState | 'selection';
  readonly rows: readonly DisplayRow[];
  readonly count: number;
  readonly error: string;
  readonly stale: boolean;
  readonly authenticated: boolean;
  readonly navigation: readonly MiniappNavigationItem[];
  readonly memberships: readonly MembershipChoice[];
  readonly actions: readonly MiniappAction[];
  readonly commanding: boolean;
  readonly commandMessage: string;
  readonly commandError: string;
}

interface PageMethods {
  route?: RouteMatch;
  active?: AbortController;
  actionInputs?: Record<string, string>;
  onLoad(options: Readonly<Record<string, string | undefined>>): void;
  onUnload(): void;
  onPullDownRefresh(): void;
  onRetry(): void;
  onSignIn(): void;
  onSignOut(): void;
  onSelectMembership(event: unknown): void;
  onNavigate(event: unknown): void;
  onSelectRecord(event: unknown): void;
  onActionInput(event: unknown): void;
  onActionSubmit(event: unknown): void;
  onShareAppMessage(): Readonly<{ title: string; path: string }>;
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
  actions: Object.freeze([]),
  commanding: false,
  commandMessage: '',
  commandError: '',
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
    onSelectRecord(event) {
      if (this.route === undefined) return;
      const destination = currentRuntime().destination(feature, this.route, eventDetail(event, 'key'));
      if (destination !== undefined) navigateMiniapp(destination);
    },
    onActionInput(event) {
      const detail = eventRecord(event);
      const key = recordText(detail, 'key', 512);
      const value = recordText(detail, 'value', 2048, true);
      (this.actionInputs ??= {})[key] = value;
    },
    onActionSubmit(event) {
      const route = this.route;
      const id = eventDetail(event, 'action');
      const action = this.data.actions.find((candidate) => candidate.id === id);
      if (route === undefined || action === undefined || this.data.commanding) return;
      void confirmAction(action).then((confirmed) => {
        if (!confirmed) return;
        this.active?.abort(new Error('COMMAND_STARTED'));
        const active = new AbortController();
        this.active = active;
        this.setData({ commanding: true, commandError: '', commandMessage: '' });
        const input = Object.freeze(Object.fromEntries(action.fields.map(({ name }) => [name, this.actionInputs?.[`${id}:${name}`] ?? ''])));
        void currentRuntime()
          .command(feature, route, id, input, active.signal)
          .then((result) => {
            this.actionInputs = {};
            if (result.destination !== undefined) navigateMiniapp(result.destination);
            else if (result.snapshot !== undefined) publishSnapshot(this, result.snapshot, result.message);
          })
          .catch((cause: unknown) => this.setData({ commanding: false, commandError: safeMessage(cause) }));
      });
    },
    onShareAppMessage() {
      const route = this.route;
      return Object.freeze({
        title: this.data.title,
        path: route === undefined ? miniappPagePath(feature.defaultRoute) : miniappPagePath(route.id, route.parameters as Readonly<Record<string, string>>),
      });
    },
    async load() {
      const route = this.route;
      if (route === undefined) return;
      this.active?.abort(new Error('REQUEST_REPLACED'));
      const active = new AbortController();
      this.active = active;
      this.setData({ state: 'loading', error: '', memberships: Object.freeze([]) });
      try {
        const value = await currentRuntime().read(feature, route, active.signal);
        if (active.signal.aborted) return;
        publishSnapshot(this, value);
      } catch (cause) {
        if (active.signal.aborted) return;
        const failure = currentRuntime().failure(cause);
        this.setData({ state: failure.state, error: failure.authenticationRequired ? '登录后即可查看这项内容。' : failure.message, authenticated: false, stale: false });
      }
    },
  });
}

function publishSnapshot(instance: PageInstance<PageData>, value: MiniappSnapshot, message = ''): void {
  wx.setNavigationBarTitle({ title: value.title });
  instance.setData({
    title: value.title,
    description: value.description,
    state: value.stale ? 'partial' : value.data.rows.length === 0 ? 'empty' : 'success',
    rows: value.data.rows,
    count: value.data.count,
    stale: value.stale,
    authenticated: value.authenticated,
    navigation: value.navigation,
    actions: value.actions,
    commanding: false,
    commandMessage: message,
    commandError: '',
  });
}

function confirmAction(action: MiniappAction): Promise<boolean> {
  if (action.confirmation === undefined) return Promise.resolve(true);
  return new Promise((resolve, reject) => wx.showModal({ title: `确认${action.label}`, content: action.confirmation!, confirmText: '确认', cancelText: '返回', success: ({ confirm }) => resolve(confirm), fail: reject }));
}

function currentRuntime(): MiniappRuntime {
  const application = getApp<MiniappInstance>();
  if (application.runtime !== undefined) return application.runtime;
  throw application.startupError ?? new Error('MINIAPP_RUNTIME_UNAVAILABLE');
}

function eventDetail(event: unknown, key: string): string {
  return recordText(eventRecord(event), key, 512);
}

function eventRecord(event: unknown): object {
  if (event === null || typeof event !== 'object') throw new Error('MINIAPP_EVENT_INVALID');
  const detail = Reflect.get(event, 'detail');
  if (detail === null || typeof detail !== 'object') throw new Error('MINIAPP_EVENT_INVALID');
  return detail;
}

function recordText(record: object, key: string, maximum: number, empty = false): string {
  const value = Reflect.get(record, key);
  if (typeof value !== 'string' || (!empty && value.length === 0) || value.length > maximum) throw new Error('MINIAPP_EVENT_INVALID');
  return value;
}

function safeMessage(cause: unknown): string {
  try {
    return currentRuntime().failure(cause).message;
  } catch {
    return '系统暂时无法完成操作，请检查小程序配置后重试。';
  }
}
