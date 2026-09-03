import type { FailureAction } from '../Action';

export const CHINESE_ACTIONS: Readonly<Record<FailureAction, string>> = Object.freeze({
  retry: '重试',
  signin: '重新登录',
  stepup: '验证身份',
  refresh: '刷新',
  contact: '联系管理员',
  none: '',
});

export const CHINESE_TITLES = Object.freeze({
  authentication: '需要重新验证',
  authorization: '暂时无法访问',
  validation: '请检查输入',
  conflict: '状态已经变化',
  rate: '操作过于频繁',
  dependency: '服务暂时不可用',
  internal: '系统暂时不可用',
  notfound: '未找到相关内容',
} as const);
