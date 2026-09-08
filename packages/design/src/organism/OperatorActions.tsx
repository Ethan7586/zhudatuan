import type { ActionInput, OperatorAction } from '@shop/presentation/actions';
import { validateActionInput } from '@shop/presentation/actions';
import { presentError } from '@shop/presentation';
import { useId, useState } from 'react';
import { CameraScanner } from '../molecule/CameraScanner';

export interface OperatorActionResult {
  readonly message: string;
  readonly destination?: string;
  readonly keepOpen?: boolean;
}

export function OperatorActions({
  actions,
  selectedKey,
  execute,
}: Readonly<{
  actions: readonly OperatorAction[];
  selectedKey?: string;
  execute: (action: OperatorAction, input: ActionInput) => Promise<OperatorActionResult>;
}>) {
  const [activeId, setActiveId] = useState<string>();
  const [values, setValues] = useState<Record<string, string | File>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Readonly<{ kind: 'success' | 'error'; text: string }>>();
  const [scanField, setScanField] = useState<string>();
  const formId = useId();
  const active = actions.find(({ id }) => id === activeId);
  if (actions.length === 0)
    return notice ? (
      <section className="operatoractions" aria-label="操作结果">
        <p className={`operatornotice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
          {notice.text}
        </p>
      </section>
    ) : null;

  const choose = (action: OperatorAction) => {
    setActiveId(action.id);
    setValues(Object.fromEntries(action.fields.map((field) => [field.name, field.value])));
    setNotice(undefined);
  };
  const submit = async () => {
    if (!active || busy) return;
    try {
      setBusy(true);
      setNotice(undefined);
      if (!navigator.onLine) throw new Error('网络不可用，操作尚未提交。请恢复网络后重试。');
      const result = await execute(active, validateActionInput(active, values));
      setNotice({ kind: 'success', text: result.message });
      if (result.keepOpen !== true) {
        setActiveId(undefined);
        setValues({});
      }
    } catch (cause) {
      setNotice({ kind: 'error', text: readable(cause) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="operatoractions" aria-label="可执行操作">
      <header>
        <div>
          <h2>下一步操作</h2>
          <p>{selectedKey ? `已选择 ${short(selectedKey)}` : '先选择一条记录；查询、扫码和交班可直接开始。'}</p>
        </div>
      </header>
      <div className="operatoractionchoices">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={`operatoractionchoice operatoraction${action.tone}`}
            disabled={action.requiresSelection === true && selectedKey === undefined}
            aria-pressed={activeId === action.id}
            onClick={() => choose(action)}
          >
            <strong>{action.label}</strong>
            <span>{action.description}</span>
          </button>
        ))}
      </div>
      {active ? (
        <form
          className="operatoractionform"
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="operatoractionheading">
            <div>
              <strong>{active.label}</strong>
              <p>{active.confirmation ?? active.description}</p>
            </div>
            <button type="button" onClick={() => setActiveId(undefined)}>
              取消
            </button>
          </div>
          <div className="operatorfields">
            {active.fields.map((field) => (
              <label key={field.name} htmlFor={`${formId}-${field.name}`}>
                <span>
                  {field.label}
                  {field.required ? '（必填）' : '（选填）'}
                </span>
                {field.kind === 'file' ? (
                  <input
                    id={`${formId}-${field.name}`}
                    type="file"
                    required={field.required}
                    accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setValues((current) => (file === undefined ? current : { ...current, [field.name]: file }));
                    }}
                  />
                ) : field.kind === 'choice' ? (
                  <select id={`${formId}-${field.name}`} required={field.required} value={stringValue(values[field.name])} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}>
                    <option value="">请选择</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.kind === 'textarea' ? (
                  <textarea
                    id={`${formId}-${field.name}`}
                    required={field.required}
                    maxLength={field.maximumLength}
                    placeholder={field.placeholder}
                    value={stringValue(values[field.name])}
                    onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                  />
                ) : (
                  <div className="operatorfieldinput">
                    <input
                      id={`${formId}-${field.name}`}
                      required={field.required}
                      maxLength={field.maximumLength}
                      placeholder={field.placeholder}
                      type={field.kind === 'password' ? 'password' : field.kind === 'number' ? 'number' : 'text'}
                      inputMode={field.kind === 'number' ? 'numeric' : undefined}
                      autoComplete="off"
                      value={stringValue(values[field.name])}
                      onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                    />
                    {field.kind === 'scan' ? (
                      <button type="button" onClick={() => setScanField(field.name)}>
                        相机扫码
                      </button>
                    ) : null}
                  </div>
                )}
              </label>
            ))}
          </div>
          <button className={`operatorsubmit operatoraction${active.tone}`} type="submit" disabled={busy}>
            {busy ? '正在提交…' : `确认${active.label}`}
          </button>
        </form>
      ) : null}
      {notice ? (
        <p className={`operatornotice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
          {notice.text}
        </p>
      ) : null}
      {scanField ? (
        <CameraScanner
          onClose={() => setScanField(undefined)}
          onValue={(value) => {
            setValues((current) => ({ ...current, [scanField]: value }));
            setScanField(undefined);
          }}
        />
      ) : null}
    </section>
  );
}

function readable(cause: unknown): string {
  if (cause instanceof Error && cause.message && !/^[A-Z0-9_:.-]+$/.test(cause.message)) return cause.message;
  return presentError(cause).message;
}

function short(value: string): string {
  return value.length <= 24 ? value : `${value.slice(0, 12)}…${value.slice(-6)}`;
}

function stringValue(value: string | File | undefined): string {
  return typeof value === 'string' ? value : '';
}
