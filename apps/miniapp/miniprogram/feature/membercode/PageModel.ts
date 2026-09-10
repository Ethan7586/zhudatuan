import type { RouteMatch } from '../../generated/RouteBinding';
import type { MembershipChoice } from '../../runtime/MiniappRuntime';
import type { MiniappNavigationItem } from '../../runtime/Navigation';
import { MemberCodeGateway } from './infrastructure/MemberCodeGateway';
import type { MiniappMemberCode } from './model/MemberCode';

export type MemberCodePageState = 'loading' | 'ready' | 'hidden' | 'needsmobile' | 'selection' | 'verification' | 'error' | 'expired';

export interface PageData {
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

export interface PageMethods {
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

export const initialMemberCodePage: PageData = Object.freeze({
  title: '会员码',
  description: '到店出示动态会员码，安全确认当前福利身份。',
  state: 'loading',
  authenticated: false,
  navigation: Object.freeze([]),
  memberships: Object.freeze([]),
  name: '',
  mobileState: '',
  welfare: '¥0.00',
  meal: '¥0.00',
  modules: Object.freeze([]),
  matrixSize: 0,
  remaining: 0,
  progress: 0,
  refreshWait: 0,
  busy: false,
  error: '',
  phoneMasked: '',
  challengeSent: false,
  code: '',
  bright: false,
});
