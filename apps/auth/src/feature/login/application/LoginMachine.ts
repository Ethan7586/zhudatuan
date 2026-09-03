import type { LoginEvent, LoginState } from '../model/LoginState';

export function loginMachine(state: LoginState, event: LoginEvent): LoginState {
  if ('command' in event && event.command !== state.command) return state;
  if (state.phase === 'redirecting' || state.phase === 'terminalfailure') {
    return event.type === 'BOOTSTRAP_REQUESTED' ? bootstrap(state, event.target) : state;
  }
  switch (event.type) {
    case 'BOOTSTRAP_REQUESTED': return bootstrap(state, event.target);
    case 'TARGET_CHANGED': return event.target === state.target ? state : bootstrap(state, event.target);
    case 'BOOTSTRAP_SUCCEEDED':
      return state.phase === 'bootstrapping'
        ? Object.freeze({ ...base(state), phase: 'ready', target: event.bootstrap.target, method: event.bootstrap.preferredMethod, bootstrap: event.bootstrap })
        : state;
    case 'BOOTSTRAP_FAILED': return state.phase === 'bootstrapping' ? Object.freeze({ ...base(state), phase: 'bootstrapfailure', failure: event.failure }) : state;
    case 'METHOD_CHANGED':
      return (state.phase === 'ready' || state.phase === 'recoverablefailure') && state.bootstrap.methods.includes(event.method)
        ? Object.freeze({ ...base(state), phase: 'ready', method: event.method, bootstrap: state.bootstrap })
        : state;
    case 'ACCEPTANCE_CHANGED': return isRunning(state) ? state : Object.freeze({ ...state, accepted: event.accepted });
    case 'NOTICE_CHANGED': return isRunning(state) ? state : Object.freeze({ ...state, notice: event.notice });
    case 'CHALLENGE_REQUESTED': return state.phase === 'ready' ? Object.freeze({ ...base(state), phase: 'challengepending', command: state.command + 1, bootstrap: state.bootstrap }) : state;
    case 'CHALLENGE_SUCCEEDED': return state.phase === 'challengepending' ? Object.freeze({ ...base(state), phase: 'ready', bootstrap: state.bootstrap, notice: event.notice }) : state;
    case 'CHALLENGE_FAILED': return state.phase === 'challengepending' ? Object.freeze({ ...base(state), phase: 'recoverablefailure', bootstrap: state.bootstrap, failure: event.failure }) : state;
    case 'SUBMIT_REQUESTED':
      return (((state.phase === 'ready' || state.phase === 'recoverablefailure') && state.accepted) || state.phase === 'membershipselection' || state.phase === 'proof')
        ? Object.freeze({ ...base(state), phase: event.invitation ? 'resolvinginvitation' : 'submitting', command: state.command + 1, bootstrap: state.bootstrap })
        : state;
    case 'INVITATION_RESOLVED': return state.phase === 'resolvinginvitation' ? Object.freeze({ ...base(state), phase: 'submitting', bootstrap: state.bootstrap }) : state;
    case 'AUTHENTICATED': return isRunning(state) || state.phase === 'membershipselection' || state.phase === 'proof' || state.phase === 'enrollment' ? Object.freeze({ ...base(state), phase: 'exchangingticket', redirectUrl: event.redirectUrl, bootstrap: state.bootstrap }) : state;
    case 'TICKET_EXCHANGED': return state.phase === 'exchangingticket' ? Object.freeze({ ...base(state), phase: 'redirecting', redirectUrl: state.redirectUrl, bootstrap: state.bootstrap }) : state;
    case 'ENROLLMENT_REQUIRED': return isRunning(state) ? Object.freeze({ ...base(state), phase: 'enrollment', enrollment: event.enrollment, submitting: false, bootstrap: state.bootstrap }) : state;
    case 'ENROLLMENT_SUBMIT_REQUESTED': return state.phase === 'enrollment' && !state.submitting ? Object.freeze({ ...state, submitting: true, command: state.command + 1 }) : state;
    case 'ENROLLMENT_FAILED': return state.phase === 'enrollment' && state.submitting ? Object.freeze({ ...state, submitting: false }) : state;
    case 'PROOF_REQUIRED': return isRunning(state) ? Object.freeze({ ...base(state), phase: 'proof', reference: event.reference, methodKind: event.method, expiresAt: event.expiresAt, bootstrap: state.bootstrap }) : state;
    case 'MEMBERSHIP_REQUIRED': return isRunning(state) ? Object.freeze({ ...base(state), phase: 'membershipselection', memberships: event.memberships, bootstrap: state.bootstrap }) : state;
    case 'ENROLLMENT_COMPLETED': return state.phase === 'enrollment' && state.submitting ? Object.freeze({ ...base(state), phase: 'ready', bootstrap: state.bootstrap, notice: event.notice }) : state;
    case 'RECOVERABLE_FAILED': return isRunning(state) || state.phase === 'membershipselection' || state.phase === 'proof' || state.phase === 'enrollment' ? Object.freeze({ ...base(state), phase: 'recoverablefailure', bootstrap: state.bootstrap, failure: event.failure }) : state;
    case 'TERMINAL_FAILED': return Object.freeze({ ...base(state), phase: 'terminalfailure', failure: event.failure });
    case 'CANCELLED': return isRunning(state) || state.phase === 'bootstrapping' ? Object.freeze({ ...base(state), phase: 'cancelled' }) : state;
    case 'RETRY_REQUESTED':
      if (state.phase === 'bootstrapfailure' || state.phase === 'cancelled') return bootstrap(state, state.target);
      if (state.phase === 'recoverablefailure' && state.bootstrap) return Object.freeze({ ...base(state), phase: 'ready', bootstrap: state.bootstrap });
      return state;
    case 'BACK_REQUESTED': return state.phase === 'membershipselection' || state.phase === 'proof' || (state.phase === 'enrollment' && !state.submitting) ? Object.freeze({ ...base(state), phase: 'ready', bootstrap: state.bootstrap }) : state;
  }
}

function isRunning(state: LoginState): state is Extract<LoginState, { phase: 'challengepending' | 'submitting' | 'resolvinginvitation' | 'exchangingticket' }> {
  return state.phase === 'challengepending' || state.phase === 'submitting' || state.phase === 'resolvinginvitation' || state.phase === 'exchangingticket';
}

function base(state: LoginState) {
  return Object.freeze({ target: state.target, method: state.method, accepted: state.accepted, command: state.command, ...(state.notice ? { notice: state.notice } : {}) });
}

function bootstrap(state: LoginState, target: LoginState['target']): LoginState {
  return Object.freeze({ phase: 'bootstrapping', target, method: 'password', accepted: state.accepted, command: state.command + 1 });
}
