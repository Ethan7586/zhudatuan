import { Button, Dialog } from '@shop/design';
import { useEffect, useState } from 'react';
import { consoleCommand, identityStepupComplete, identityStepupStart } from '../shared/api/Client';
import { safeQueryError } from '../shared/presentation/QueryState';
import { readActionRequest } from '../shared/security/ActionRequest';
import './StepupDialog.css';

export interface StepupDialogProps {
  readonly open: boolean;
  readonly accessVersion: number;
  readonly phoneMasked: string | null;
  readonly csrf?: string;
  readonly onClose: () => void;
  readonly onComplete: () => void;
}

export function StepupDialog({ open, accessVersion, phoneMasked, csrf, onClose, onComplete }: StepupDialogProps) {
  const [challenge, setChallenge] = useState<string>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [approval, setApproval] = useState('');
  const [purpose, setPurpose] = useState<'session' | 'review'>('session');
  const [proof, setProof] = useState<string>();
  const [expiresAt, setExpiresAt] = useState<string>();
  useEffect(() => {
    if (open) return;
    setChallenge(undefined);
    setCode('');
    setError(undefined);
    setApproval('');
    setPurpose('session');
    setProof(undefined);
    setExpiresAt(undefined);
  }, [open]);
  const request = () =>
    run(async () => {
      if (phoneMasked === null) throw new Error('STEPUP_DESTINATION_MISSING');
      const action = approval.trim() ? readActionRequest(approval) : undefined;
      const result = await identityStepupStart(
        {
          body:
            action === undefined
              ? {}
              : {
                  action: {
                    operation: action.operation,
                    resource: action.resource,
                    requestHash: action.requestHash,
                    expectedVersion: action.expectedVersion,
                    makerMembership: action.makerMembership,
                  },
                },
        },
        command(accessVersion, csrf)
      );
      if (result.actionBound !== (action !== undefined)) throw new Error('ACTION_REQUEST_BINDING_INVALID');
      setChallenge(result.id);
      setCode('');
    });
  const complete = () =>
    run(async () => {
      if (challenge === undefined) return;
      const result = await identityStepupComplete({ body: { challenge, code: code.trim() } }, command(accessVersion, csrf));
      if (result.assurance < 3) throw new Error('STEPUP_ASSURANCE_INVALID');
      if ('proof' in result) {
        setProof(result.proof);
        setExpiresAt(result.expiresAt);
        return;
      }
      onComplete();
    });
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await task();
    } catch (cause) {
      setError(safeQueryError(cause instanceof Error ? cause : new Error('STEPUP_FAILED')) ?? '验证失败，请重试。');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} title="开启二次验证" eyebrow="账户安全 · 身份确认" onClose={onClose} dismissable={!busy}>
      <div className="stepupstack">
        <header className="stepupintro">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>验证是为了保护关键操作</strong>
            <p>{phoneMasked === null ? '当前账号未绑定手机号，暂时无法开启二次验证。' : `验证码将发送到 ${phoneMasked}，验证状态将在 15 分钟后自动失效。`}</p>
          </div>
        </header>
        {proof !== undefined ? (
          <section className="stepupresult" aria-label="复核凭证">
            <span className="stepupsuccess" aria-hidden="true">
              ✓
            </span>
            <h3>复核凭证已生成</h3>
            <p role="status">请立即安全地交给发起人；凭证只能使用一次，提交后自动失效。</p>
            <label>
              一次性复核凭证
              <textarea aria-label="一次性复核证明" value={proof} readOnly />
            </label>
            <p>有效期至 {expiresAt ? new Date(expiresAt).toLocaleString('zh-CN') : '未知'}。</p>
            <Button tone="primary" onPress={() => void navigator.clipboard.writeText(proof)}>
              复制复核凭证
            </Button>
          </section>
        ) : challenge === undefined ? (
          <div className="stepuprequest">
            <fieldset className="stepuppurpose">
              <legend>请选择验证用途</legend>
              <button
                type="button"
                aria-pressed={purpose === 'session'}
                onClick={() => {
                  setPurpose('session');
                  setApproval('');
                }}
                disabled={busy}
              >
                <strong>验证当前账号</strong>
                <span>用于执行成员编辑、设置调整等本人操作</span>
              </button>
              <button type="button" aria-pressed={purpose === 'review'} onClick={() => setPurpose('review')} disabled={busy}>
                <strong>协助同事复核</strong>
                <span>仅在另一位管理员发来复核请求码时使用</span>
              </button>
            </fieldset>
            {purpose === 'review' ? (
              <section className="stepupreview">
                <label>
                  复核请求码
                  <textarea aria-label="复核请求码" value={approval} autoComplete="off" spellCheck={false} placeholder="粘贴发起人提供的复核请求码" onChange={(event) => setApproval(event.target.value.trim())} disabled={busy} />
                </label>
                <p>系统会校验操作内容、目标项目、权限版本和发起人身份；复核人不能与发起人相同。</p>
              </section>
            ) : (
              <p className="stepupnote">完成后，当前账号将在 15 分钟内可以执行已授权的高风险操作。</p>
            )}
            {phoneMasked === null ? (
              <p className="stepuperror" role="status">
                请先在员工商城安全中心绑定手机号，再开启二次验证。
              </p>
            ) : null}
            <div className="stepupactions">
              <Button tone="primary" onPress={() => void request()} isDisabled={busy || phoneMasked === null || (purpose === 'review' && !approval)}>
                {busy ? '正在发送…' : purpose === 'review' ? '校验请求并发送验证码' : '发送验证码'}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="stepupcode"
            onSubmit={(event) => {
              event.preventDefault();
              void complete();
            }}
          >
            <div className="stepupsent" role="status">
              <strong>验证码已发送</strong>
              <span>请输入当前账号绑定手机收到的 6 位验证码。</span>
            </div>
            <label>
              6 位验证码
              <input aria-label="二次验证验证码" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} />
            </label>
            <div className="stepupactions">
              <Button onPress={() => void request()} isDisabled={busy}>
                重新发送
              </Button>
              <Button type="submit" tone="primary" isDisabled={busy || code.length !== 6}>
                {busy ? '正在验证…' : '确认验证'}
              </Button>
            </div>
          </form>
        )}
        {error === undefined ? null : (
          <p className="stepuperror" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function command(accessVersion: number, csrf: string | undefined) {
  return consoleCommand(undefined, { accessVersion, ...(csrf === undefined ? {} : { csrfToken: csrf }) });
}
