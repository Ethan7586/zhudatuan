import type { FailureAction } from '../Action';

export const ENGLISH_ACTIONS: Readonly<Record<FailureAction, string>> = Object.freeze({
  retry: 'Try again',
  signin: 'Sign in again',
  stepup: 'Verify identity',
  refresh: 'Refresh',
  contact: 'Contact support',
  none: '',
});

export const ENGLISH_TITLES = Object.freeze({
  authentication: 'Verification required',
  authorization: 'Access unavailable',
  validation: 'Check your input',
  conflict: 'State changed',
  rate: 'Too many requests',
  dependency: 'Service unavailable',
  internal: 'Service unavailable',
  notfound: 'Not found',
} as const);
