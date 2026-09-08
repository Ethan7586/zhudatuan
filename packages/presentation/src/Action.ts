export type FailureAction = 'retry' | 'signin' | 'stepup' | 'refresh' | 'contact' | 'none';

export interface ActionView {
  readonly kind: FailureAction;
  readonly label: string;
}

export type ActionTone = 'primary' | 'secondary' | 'danger';
export type ActionFieldKind = 'text' | 'number' | 'password' | 'choice' | 'textarea' | 'scan' | 'file';

export interface ActionFieldOption {
  readonly value: string;
  readonly label: string;
}

export interface ActionField {
  readonly name: string;
  readonly label: string;
  readonly kind: ActionFieldKind;
  readonly placeholder: string;
  readonly required: boolean;
  readonly maximumLength: number;
  readonly options: readonly ActionFieldOption[];
  readonly value: string;
}

export interface OperatorAction {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly tone: ActionTone;
  readonly confirmation?: string;
  readonly expectedVersion?: number;
  readonly identityScope?: boolean;
  readonly requiresSelection?: boolean;
  readonly fields: readonly ActionField[];
}

export type ActionInput = Readonly<Record<string, string | File>>;

export interface CommandResult {
  readonly message: string;
  readonly destination?: string;
  readonly data?: unknown;
  readonly payment?: Readonly<Record<string, string>>;
  readonly clipboard?: string;
}

export function actionField(
  name: string,
  label: string,
  options: Readonly<{ kind?: ActionFieldKind; placeholder?: string; required?: boolean; maximumLength?: number; choices?: readonly ActionFieldOption[]; value?: string }> = {}
): ActionField {
  return Object.freeze({
    name,
    label,
    kind: options.kind ?? 'text',
    placeholder: options.placeholder ?? `请输入${label}`,
    required: options.required ?? true,
    maximumLength: options.maximumLength ?? 255,
    options: Object.freeze([...(options.choices ?? [])]),
    value: options.value ?? '',
  });
}

export function requiredText(input: ActionInput, name: string, maximumLength = 255): string {
  const source = input[name];
  const value = typeof source === 'string' ? source.trim() : undefined;
  if (value === undefined || value.length === 0 || value.length > maximumLength || hasControl(value)) throw new Error(`MINIAPP_ACTION_FIELD_INVALID:${name}`);
  return value;
}

export function optionalText(input: ActionInput, name: string, maximumLength = 255): string | undefined {
  const source = input[name];
  const value = typeof source === 'string' ? source.trim() : undefined;
  if (value === undefined || value.length === 0) return undefined;
  if (value.length > maximumLength || hasControl(value)) throw new Error(`MINIAPP_ACTION_FIELD_INVALID:${name}`);
  return value;
}

export function requiredInteger(input: ActionInput, name: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  return boundedInteger(requiredText(input, name, 16), name, /^\d+$/, minimum, maximum);
}

export function requiredSignedInteger(input: ActionInput, name: string, minimum: number, maximum: number): number {
  return boundedInteger(requiredText(input, name, 16), name, /^-?(?:0|[1-9]\d*)$/, minimum, maximum);
}

export function requiredMoneyMinor(input: ActionInput, name: string): number {
  const value = requiredText(input, name, 32);
  if (!/^(?:0|[1-9]\d{0,10})(?:\.\d{1,2})?$/.test(value)) throw new Error(`MINIAPP_ACTION_FIELD_INVALID:${name}`);
  const [units = '0', decimals = ''] = value.split('.');
  const minor = Number(units) * 100 + Number(decimals.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new Error(`MINIAPP_ACTION_FIELD_INVALID:${name}`);
  return minor;
}

export function requiredFile(input: ActionInput, name: string): File {
  const value = input[name];
  if (typeof File === 'undefined' || !(value instanceof File) || value.size < 1) throw new Error(`MINIAPP_ACTION_FIELD_INVALID:${name}`);
  return value;
}

export function validateActionInput(action: OperatorAction, input: ActionInput): ActionInput {
  const expected = new Set(action.fields.map(({ name }) => name));
  if (Object.keys(input).some((name) => !expected.has(name))) throw new Error('MINIAPP_ACTION_FIELD_UNKNOWN');
  for (const field of action.fields) {
    const source = input[field.name];
    if (field.kind === 'file') {
      if (field.required && (typeof File === 'undefined' || !(source instanceof File) || source.size < 1)) throw new Error(`MINIAPP_ACTION_FIELD_REQUIRED:${field.name}`);
      continue;
    }
    const value = typeof source === 'string' ? source.trim() : '';
    if (field.required && value.length === 0) throw new Error(`MINIAPP_ACTION_FIELD_REQUIRED:${field.name}`);
    if (value.length > field.maximumLength || hasControl(value)) throw new Error(`MINIAPP_ACTION_FIELD_INVALID:${field.name}`);
    if (field.kind === 'choice' && value && !field.options.some((option) => option.value === value)) throw new Error(`MINIAPP_ACTION_FIELD_INVALID:${field.name}`);
  }
  return Object.freeze(Object.fromEntries(Object.entries(input).map(([name, value]) => [name, typeof value === 'string' ? value.trim() : value])));
}

function hasControl(value: string): boolean {
  return [...value].some((character) => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127);
}

function boundedInteger(value: string, name: string, pattern: RegExp, minimum: number, maximum: number): number {
  if (!pattern.test(value)) throw new Error(`MINIAPP_ACTION_FIELD_INVALID:${name}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`MINIAPP_ACTION_FIELD_INVALID:${name}`);
  return parsed;
}

export type MiniappActionTone = ActionTone;
export type MiniappFieldKind = ActionFieldKind;
export type MiniappFieldOption = ActionFieldOption;
export type MiniappActionField = ActionField;
export type MiniappAction = OperatorAction;
export type MiniappActionInput = ActionInput;
export type MiniappCommandResult = CommandResult;
