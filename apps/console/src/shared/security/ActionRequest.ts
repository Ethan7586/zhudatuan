import { OperationCatalog, type OperationId } from '@shop/contract';

export interface ActionRequest {
  readonly version: 1;
  readonly operation: OperationId;
  readonly resource: string;
  readonly requestHash: string;
  readonly expectedVersion: number;
  readonly makerMembership: string;
}

export async function createActionRequest(operation: OperationId, input: Readonly<{ path?: Readonly<Record<string, string>>; body: unknown }>, expectedVersion: number, makerMembership: string, scopeResource?: string): Promise<string> {
  assertAction(operation, expectedVersion, makerMembership);
  const path: Readonly<Record<string, string>> = input.path ?? Object.freeze({});
  const resource = Object.values(path)[0] ?? scopeResource;
  if (!resource) throw new Error('ACTION_REQUEST_RESOURCE_REQUIRED');
  const requestHash = await sha256(JSON.stringify({ type: operation, path, query: {}, body: input.body, expectedVersion }));
  return encode({ version: 1, operation, resource, requestHash, expectedVersion, makerMembership });
}

export function readActionRequest(value: string): ActionRequest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decode(value.trim()));
  } catch (cause) {
    throw new Error('ACTION_REQUEST_INVALID', { cause });
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('ACTION_REQUEST_INVALID');
  const request = parsed as Partial<ActionRequest>;
  if (
    request.version !== 1 ||
    typeof request.operation !== 'string' ||
    typeof request.resource !== 'string' ||
    !request.resource ||
    typeof request.requestHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(request.requestHash) ||
    typeof request.expectedVersion !== 'number' ||
    typeof request.makerMembership !== 'string'
  ) {
    throw new Error('ACTION_REQUEST_INVALID');
  }
  assertAction(request.operation, request.expectedVersion, request.makerMembership);
  return Object.freeze(request as ActionRequest);
}

function assertAction(operation: OperationId, expectedVersion: number, makerMembership: string): void {
  const definition = OperationCatalog.get(operation);
  if (!definition.makerChecker || definition.expectedVersion !== 'required') throw new Error('ACTION_REQUEST_OPERATION_INVALID');
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || !makerMembership) throw new Error('ACTION_REQUEST_INVALID');
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (item) => item.toString(16).padStart(2, '0')).join('');
}

function encode(value: ActionRequest): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decode(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('ACTION_REQUEST_INVALID');
  const base64 = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}
