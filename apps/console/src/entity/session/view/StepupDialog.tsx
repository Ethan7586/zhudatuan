import { Button, Dialog } from '@shop/design';
import type { FormEvent } from 'react';
import type { StepupViewModel } from '../viewmodel/StepupViewModel';
import './StepupDialog.css';

export function StepupDialog({ model }: Readonly<{ model: StepupViewModel }>) {
  const { actions } = model;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    actions.complete();
  };
  return (
    <Dialog open={model.open} title="开启二次验证" eyebrow="账户安全 · 身份确认" onClose={actions.close} dismissable={!model.busy}>
      <div className="stepupstack">
        <header className="stepupintro">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>验证是为了保护关键操作</strong>
            <p>{model.phoneMasked === null ? '当前账号未绑定手机号，暂时无法开启二次验证。' : `验证码将发送到 ${model.phoneMasked}，验证状态将在 15 分钟后自动失效。`}</p>
          </div>
        </header>
        {model.proof !== undefined ? (
          <section className="stepupresult" aria-label="复核凭证">
            <span className="stepupsuccess" aria-hidden="true">
              ✓
            </span>
            <h3>复核凭证已生成</h3>
            <p role="status">请立即安全地交给发起人；凭证只能使用一次，提交后自动失效。</p>
            <label>
              一次性复核凭证
              <textarea aria-label="一次性复核证明" value={model.proof} readOnly />
            </label>
            <p>有效期至 {model.expires}。</p>
            <Button tone="primary" onPress={actions.copyProof}>
              复制复核凭证
            </Button>
          </section>
        ) : model.challenge === undefined ? (
          <StepupRequest model={model} />
        ) : (
          <form className="stepupcode" onSubmit={submit}>
            <div className="stepupsent" role="status">
              <strong>验证码已发送</strong>
              <span>请输入当前账号绑定手机收到的 6 位验证码。</span>
            </div>
            <label>
              6 位验证码
              <input aria-label="二次验证验证码" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={model.code} onChange={(event) => actions.updateCode(event.target.value)} disabled={model.busy} />
            </label>
            <div className="stepupactions">
              <Button onPress={actions.request} isDisabled={model.busy}>
                重新发送
              </Button>
              <Button type="submit" tone="primary" isDisabled={model.busy || model.code.length !== 6}>
                {model.busy ? '正在验证…' : '确认验证'}
              </Button>
            </div>
          </form>
        )}
        {model.error === undefined ? null : (
          <p className="stepuperror" role="alert">
            {model.error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function StepupRequest({ model }: Readonly<{ model: StepupViewModel }>) {
  const { actions } = model;
  return (
    <div className="stepuprequest">
      <fieldset className="stepuppurpose">
        <legend>请选择验证用途</legend>
        <button type="button" aria-pressed={model.purpose === 'session'} onClick={() => actions.selectPurpose('session')} disabled={model.busy}>
          <strong>验证当前账号</strong>
          <span>用于执行成员编辑、设置调整等本人操作</span>
        </button>
        <button type="button" aria-pressed={model.purpose === 'review'} onClick={() => actions.selectPurpose('review')} disabled={model.busy}>
          <strong>协助同事复核</strong>
          <span>仅在另一位管理员发来复核请求码时使用</span>
        </button>
      </fieldset>
      {model.purpose === 'review' ? (
        <section className="stepupreview">
          <label>
            复核请求码
            <textarea aria-label="复核请求码" value={model.approval} autoComplete="off" spellCheck={false} placeholder="粘贴发起人提供的复核请求码" onChange={(event) => actions.updateApproval(event.target.value)} disabled={model.busy} />
          </label>
          <p>系统会校验操作内容、目标项目、权限版本和发起人身份；复核人不能与发起人相同。</p>
        </section>
      ) : (
        <p className="stepupnote">完成后，当前账号将在 15 分钟内可以执行已授权的高风险操作。</p>
      )}
      {model.phoneMasked === null ? (
        <p className="stepuperror" role="status">
          请先在员工商城安全中心绑定手机号，再开启二次验证。
        </p>
      ) : null}
      <div className="stepupactions">
        <Button tone="primary" onPress={actions.request} isDisabled={model.busy || model.phoneMasked === null || (model.purpose === 'review' && !model.approval)}>
          {model.busy ? '正在发送…' : model.purpose === 'review' ? '校验请求并发送验证码' : '发送验证码'}
        </Button>
      </div>
    </div>
  );
}
