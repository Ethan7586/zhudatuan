import { OperationCatalog } from '@shop/contract';
import { requireSession } from '../platform/security/OperationSecurityContext';
import type { OperationRequest } from './OperationRequest';

export function requireAccess(request: OperationRequest) {
  return requireSession(request.security);
}

export function publicOperationScope(request: OperationRequest): string {
  const module = OperationCatalog.get(request.type).module;
  const target = request.security.kind === 'session' ? request.security.access.actor.target : request.security.target;
  const partition = target ?? (request.security.kind === 'anonymous' ? request.security.channel : 'preauth');
  return `public:${module}:${partition}`;
}
