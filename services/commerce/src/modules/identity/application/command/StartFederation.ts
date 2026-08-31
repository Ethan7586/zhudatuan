import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import type { FederationService } from '../service/FederationService';
export class StartFederation {
  constructor(private readonly federation: FederationService) {}
  action(): OperationAction {
    return (request, database) => {
      const body = bodyRecord(request);
      return this.federation.start(database, { provider: textField(body, 'providerid', 36), returntarget: textField(body, 'returntarget', 2048), authorization: body.authorization }, requestContext(request));
    };
  }
}
export function requestContext(request: Parameters<OperationAction>[0]) {
  return Object.freeze({
    peer: request.input.headers['x-peer-address'] ?? 'unknown',
    agent: request.input.headers['user-agent'] ?? 'unknown',
    device: request.input.headers['x-device-id'] ?? 'browser',
    trace: request.input.headers['x-trace-id'] ?? request.input.idempotency ?? 'federation',
    signal: request.input.signal,
    deadline: request.input.deadline,
  });
}
