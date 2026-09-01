export interface OperationDefinition {
  readonly id: string;
  readonly owner: string;
  readonly method: string;
  readonly path: string;
  readonly permission?: string;
  readonly requirements: readonly string[];
}

export interface RequirementBinding {
  readonly module: string;
  readonly operation: string;
  readonly route: string;
  readonly journey: string;
  readonly table: string;
}

export function operationForBinding(operations: readonly OperationDefinition[], requirement: string, binding: RequirementBinding): OperationDefinition {
  const operation = operations.find(({ id }) => id === binding.operation);
  if (!operation) throw new Error('REQUIREMENT_OPERATION_UNKNOWN:' + requirement + ':' + binding.operation);
  if (operation.owner !== binding.module) throw new Error('REQUIREMENT_OPERATION_OWNER_MISMATCH:' + requirement + ':' + binding.module + ':' + operation.owner);
  if (!operation.path.startsWith('/api/v1')) throw new Error('REQUIREMENT_OPERATION_PATH_INVALID:' + requirement + ':' + operation.path);
  return operation;
}

export function priorityFrom(value: string): string {
  return /P3/i.test(value) ? 'P3' : /P2/i.test(value) ? 'P2' : 'Unspecified';
}

export function stepupFor(value: string): string {
  return /提现|退款|密码|权限|角色|白名单|开票|支付/.test(value) ? 'required' : 'policy';
}
