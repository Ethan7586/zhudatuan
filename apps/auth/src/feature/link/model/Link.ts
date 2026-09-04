export interface LinkGuidance {
  readonly title: string;
  readonly detail: string;
}

export interface IdentityLink {
  readonly id: string;
  readonly provider: string;
  readonly principal: string;
  readonly status: 'active' | 'revoked';
  readonly version: number;
}

export interface LinkSnapshot {
  readonly links: readonly IdentityLink[];
}

export const LINK_GUIDANCE: LinkGuidance = Object.freeze({
  title: '需要确认身份关联',
  detail: '检测到已有身份或绑定冲突。系统不会自动合并账号，请联系企业管理员完成强验证与人工确认。',
});
