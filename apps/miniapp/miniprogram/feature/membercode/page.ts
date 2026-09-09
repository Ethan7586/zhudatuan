import { MEMBER_CODE_SECONDS } from '@shop/contract/verification';
import { miniappPagePath, readMiniappRoute } from '../../generated/PageBinding';
import type { RouteMatch } from '../../generated/RouteBinding';
import type { MembershipChoice, MiniappRuntime } from '../../runtime/MiniappRuntime';
import { routeFromOptions } from '../../runtime/DeepLink';
import { navigateMiniapp, type MiniappNavigationItem } from '../../runtime/Navigation';
import type { MiniappInstance } from '../../platform/Wechat';
import { randomToken } from '../../platform/Random';
import { MemberCodeGateway } from './infrastructure/MemberCodeGateway';
import type { MemberIdentity, MiniappMemberCode } from './model/MemberCode';
import { refreshWaitSeconds, remainingSeconds } from './model/MemberCode';
import { MemberCodeManifest } from './Manifest';

type MemberCodePageState = 'loading' | 'ready' | 'hidden' | 'needsmobile' | 'selection' | 'verification' | 'error' | 'expired';

interface PageData {
  readonly title: string;
  readonly description: string;
  readonly state: MemberCodePageState;
  readonly authenticated: boolean;
  readonly navigation: readonly MiniappNavigationItem[];
  readonly memberships: readonly MembershipChoice[];
  readonly name: string;
  readonly mobileState: string;
  readonly welfare: string;
  readonly meal: string;
  readonly modules: readonly Readonly<{ key: string; dark: boolean }>[];
  readonly matrixSize: number;
  readonly remaining: number;
  readonly progress: number;
  readonly refreshWait: number;
  readonly busy: boolean;
  readonly error: string;
  readonly phoneMasked: string;
  readonly challengeSent: boolean;
  readonly code: string;
  readonly bright: boolean;
}

interface PageMethods {
  route?: RouteMatch;
  active?: AbortController;
  timer?: number | undefined;
  gateway?: MemberCodeGateway;
  memberCode?: MiniappMemberCode | undefined;
  issueKey?: string;
  stepupChallenge?: string;
  onLoad(options: Readonly<Record<string, string | undefined>>): void;
  onUnload(): void;
  onPullDownRefresh(): void;
  onNavigate(event: unknown): void;
  onSignIn(): void;
  onSignOut(): void;
  onSelectMembership(event: unknown): void;
  onRetry(): void;
  onRefresh(): void;
  onHide(): void;
  onShow(): void;
  onOpenSecurity(): void;
  onToggleBrightness(): void;
  onSendCode(): void;
  onCodeInput(event: unknown): void;
  onVerify(): void;
  onShareAppMessage(): Readonly<{ title: string; path: string }>;
  load(): Promise<void>;
  issue(fresh: boolean): Promise<void>;
  tick(): void;
}

const initial: PageData = Object.freeze({
  title: '会员码', description: '到店出示动态会员码，安全确认当前福利身份。', state: 'loading', authenticated: false, navigation: Object.freeze([]), memberships: Object.freeze([]),
  name: '', mobileState: '', welfare: '¥0.00', meal: '¥0.00', modules: Object.freeze([]), matrixSize: 0, remaining: 0, progress: 0, refreshWait: 0,
  busy: false, error: '', phoneMasked: '', challengeSent: false, code: '', bright: false,
});

Page<PageData, PageMethods>({
  data: initial,
  onLoad(options) {
    try {
      const route = routeFromOptions(options, readMiniappRoute({ ...options, route: options.route ?? MemberCodeManifest.viewModel.defaultRoute }));
      if (route.id !== 'miniappmembercode') throw new Error('MINIAPP_MEMBER_CODE_ROUTE_DENIED');
      this.route = route;
      this.gateway = new MemberCodeGateway(currentRuntime());
      void this.load();
    } catch (cause) {
      this.setData({ state: 'error', error: message(cause) });
    }
  },
  onUnload() {
    this.active?.abort(new Error('PAGE_UNLOADED'));
    if (this.timer !== undefined) clearInterval(this.timer);
  },
  onPullDownRefresh() {
    const wait = this.memberCode ? refreshWaitSeconds(this.memberCode, Date.now()) : 0;
    const action = wait === 0 ? this.issue(true) : this.load();
    void action.finally(() => wx.stopPullDownRefresh());
  },
  onNavigate(event) { navigateMiniapp(detail(event, 'path')); },
  onSignIn() {
    this.setData({ state: 'loading', error: '', memberships: Object.freeze([]) });
    void currentRuntime().signIn().then((result) => result.kind === 'selection' ? this.setData({ state: 'selection', memberships: result.memberships }) : this.load()).catch((cause: unknown) => this.setData({ state: 'error', error: message(cause) }));
  },
  onSignOut() {
    this.setData({ state: 'loading', error: '' });
    void currentRuntime().signOut().then(() => this.load()).catch((cause: unknown) => this.setData({ state: 'error', error: message(cause) }));
  },
  onSelectMembership(event) {
    this.setData({ state: 'loading', error: '' });
    void currentRuntime().selectMembership(detail(event, 'id')).then(() => this.load()).catch((cause: unknown) => this.setData({ state: 'error', error: message(cause) }));
  },
  onRetry() { void (this.memberCode ? this.issue(false) : this.load()); },
  onRefresh() {
    if (this.data.refreshWait === 0) void this.issue(true);
  },
  onHide() {
    const gateway = this.gateway;
    const memberCode = this.memberCode;
    if (!gateway || !memberCode || this.data.busy) return;
    this.setData({ busy: true, error: '' });
    void randomToken(32)
      .then((key) => gateway.revoke(memberCode, key, this.active?.signal))
      .then(() => {
        this.memberCode = undefined;
        if (this.timer !== undefined) clearInterval(this.timer);
        this.setData({ state: 'hidden', modules: Object.freeze([]), matrixSize: 0, remaining: 0, progress: 0, busy: false });
      })
      .catch((cause: unknown) => this.setData({ busy: false, error: message(cause) }));
  },
  onShow() { void this.issue(true); },
  onOpenSecurity() { navigateMiniapp(miniappPagePath('miniappsecurity')); },
  onToggleBrightness() { this.setData({ bright: !this.data.bright }); },
  onSendCode() {
    const gateway = this.gateway;
    if (!gateway || this.data.busy) return;
    this.setData({ busy: true, error: '' });
    void randomToken(32)
      .then((key) => gateway.startStepup(key, this.active?.signal))
      .then((challenge) => {
        this.stepupChallenge = challenge.id;
        this.setData({ busy: false, challengeSent: true, code: '' });
      })
      .catch((cause: unknown) => this.setData({ busy: false, error: message(cause) }));
  },
  onCodeInput(event) {
    const value = inputValue(event).replace(/\D/g, '').slice(0, 6);
    this.setData({ code: value });
  },
  onVerify() {
    const gateway = this.gateway;
    const challenge = this.stepupChallenge;
    if (!gateway || !challenge || this.data.code.length !== 6 || this.data.busy) return;
    this.setData({ busy: true, error: '' });
    void randomToken(32)
      .then((key) => gateway.completeStepup(challenge, this.data.code, key, this.active?.signal))
      .then((result) => {
        if (result.assurance < 3) throw new Error('MINIAPP_STEPUP_ASSURANCE_INSUFFICIENT');
        this.setData({ challengeSent: false, code: '' });
        return this.issue(false);
      })
      .catch((cause: unknown) => this.setData({ busy: false, error: message(cause) }));
  },
  onShareAppMessage() {
    return Object.freeze({ title: '智慧翼会员码', path: miniappPagePath('miniappmembercode') });
  },
  async load() {
    const route = this.route;
    const gateway = this.gateway;
    if (!route || !gateway) return;
    this.active?.abort(new Error('REQUEST_REPLACED'));
    const active = new AbortController();
    this.active = active;
    this.memberCode = undefined;
    if (this.timer !== undefined) clearInterval(this.timer);
    this.setData({ state: 'loading', authenticated: false, error: '', modules: Object.freeze([]), memberships: Object.freeze([]) });
    try {
      const identity = await gateway.identity(active.signal);
      const snapshot = await currentRuntime().read(MemberCodeManifest.viewModel, route, active.signal);
      if (!snapshot.authenticated) throw new Error('MINIAPP_SESSION_NOT_CREATED');
      if (active.signal.aborted) return;
      publishIdentity(this, identity, snapshot.navigation);
      if (identity.mobileVerified) await this.issue(false);
    } catch (cause) {
      if (active.signal.aborted) return;
      const failure = currentRuntime().failure(cause);
      this.setData({ state: failure.authenticationRequired ? 'expired' : 'error', authenticated: false, error: failure.authenticationRequired ? '登录后即可使用会员码。' : failure.message });
    }
  },
  async issue(fresh) {
    const gateway = this.gateway;
    if (!gateway || this.data.busy) return;
    if (fresh || !this.issueKey) this.issueKey = await randomToken(32);
    this.setData({ state: 'loading', busy: true, error: '' });
    try {
      const code = await gateway.issue(this.issueKey, this.active?.signal);
      this.memberCode = code;
      this.setData({ state: 'ready', authenticated: true, modules: code.modules, matrixSize: code.matrixSize, busy: false });
      this.tick();
      if (this.timer !== undefined) clearInterval(this.timer);
      this.timer = setInterval(() => this.tick(), 500) as unknown as number;
    } catch (cause) {
      if (failureCode(cause) === 'STEPUP_REQUIRED') {
        const phoneMasked = await gateway.phoneMasked(this.active?.signal).catch(() => null);
        this.setData({ state: 'verification', authenticated: true, busy: false, phoneMasked: phoneMasked ?? '', error: '' });
      } else {
        this.setData({ state: 'error', authenticated: true, busy: false, error: message(cause) });
      }
    }
  },
  tick() {
    const code = this.memberCode;
    if (!code) return;
    const remaining = remainingSeconds(code, Date.now());
    const refreshWait = refreshWaitSeconds(code, Date.now());
    this.setData({ remaining, refreshWait, progress: Math.round((remaining / MEMBER_CODE_SECONDS) * 100) });
    if (remaining === 0) {
      if (this.timer !== undefined) clearInterval(this.timer);
      this.timer = undefined;
      void this.issue(true);
    }
  },
});

function publishIdentity(instance: ThisType<never> & { setData(value: Partial<PageData>): void }, identity: MemberIdentity, navigation: readonly MiniappNavigationItem[]): void {
  instance.setData({
    state: identity.mobileVerified ? 'loading' : 'needsmobile', authenticated: true, navigation, name: identity.name, mobileState: identity.mobileVerified ? '手机号已认证' : '手机号尚未认证',
    welfare: money(identity.welfareMinor), meal: money(identity.mealMinor), error: '',
  });
}

function currentRuntime(): MiniappRuntime {
  const application = getApp<MiniappInstance>();
  if (application.runtime !== undefined) return application.runtime;
  throw application.startupError ?? new Error('MINIAPP_RUNTIME_UNAVAILABLE');
}

function detail(event: unknown, key: string): string {
  const target = event !== null && typeof event === 'object' ? Reflect.get(event, 'currentTarget') : undefined;
  const dataset = target !== null && typeof target === 'object' ? Reflect.get(target, 'dataset') : undefined;
  const value = dataset !== null && typeof dataset === 'object' ? Reflect.get(dataset, key) : undefined;
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) throw new Error('MINIAPP_DATASET_INVALID');
  return value;
}

function inputValue(event: unknown): string {
  const detailValue = event !== null && typeof event === 'object' ? Reflect.get(event, 'detail') : undefined;
  const value = detailValue !== null && typeof detailValue === 'object' ? Reflect.get(detailValue, 'value') : undefined;
  if (typeof value !== 'string' || value.length > 6) throw new Error('MINIAPP_INPUT_INVALID');
  return value;
}

function message(cause: unknown): string {
  try { return currentRuntime().failure(cause).message; } catch { return '系统暂时无法完成操作，请稍后重试。'; }
}

function failureCode(cause: unknown): string {
  if (cause === null || typeof cause !== 'object') return '';
  const code = Reflect.get(cause, 'code');
  return typeof code === 'string' ? code : '';
}

function money(minor: number): string {
  return `¥${(minor / 100).toFixed(2)}`;
}
