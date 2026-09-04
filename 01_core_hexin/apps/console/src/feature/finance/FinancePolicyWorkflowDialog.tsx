import { useEffect, useState } from 'react';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import {
  completeFinancePolicyStepup,
  executeFinancePolicyChange,
  previewFinancePolicyChange,
  startFinancePolicyStepup,
  type FinancePolicyAction,
  type FinancePolicyDesiredState,
  type FinancePolicyManageReceipt,
  type FinancePolicyStepupChallenge,
  type PreparedFinancePolicyChange,
} from './FinancePolicyCommand';
import type { FinanceConfigPolicy } from './FinancePolicyEditorSchema';
import { FinanceIcon } from './FinanceIcon';

export interface FinancePolicyWorkflowIntent {
  readonly policy: FinanceConfigPolicy;
  readonly action: FinancePolicyAction;
  readonly desiredState: FinancePolicyDesiredState;
}

export function FinancePolicyWorkflowDialog({
  context,
  intent,
  onClose,
  onComplete,
}: Readonly<{
  context: ConsoleContext;
  intent: FinancePolicyWorkflowIntent | undefined;
  onClose: () => void;
  onComplete: (receipt: FinancePolicyManageReceipt) => Promise<void>;
}>) {
  const [reason, setReason] = useState('');
  const [prepared, setPrepared] = useState<PreparedFinancePolicyChange>();
  const [challenge, setChallenge] = useState<FinancePolicyStepupChallenge>();
  const [code, setCode] = useState('');
  const [receipt, setReceipt] = useState<FinancePolicyManageReceipt>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setReason(intent === undefined ? '' : defaultReason(intent));
    setPrepared(undefined);
    setChallenge(undefined);
    setCode('');
    setReceipt(undefined);
    setBusy(false);
    setError(undefined);
  }, [intent]);

  const preview = async () => {
    if (intent === undefined) return;
    setBusy(true);
    setError(undefined);
    try {
      setPrepared(
        await previewFinancePolicyChange(context, {
          ...intent,
          reason,
          evidence: {
            source: 'console.finance.policy',
            actor: context.session.actor,
            scope: context.scope.id,
            requestedAt: new Date().toISOString(),
          },
        })
      );
    } catch (cause) {
      setError(commandError(cause));
    } finally {
      setBusy(false);
    }
  };

  const sendChallenge = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setChallenge(await startFinancePolicyStepup(context));
    } catch (cause) {
      setError(commandError(cause));
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    if (prepared === undefined || challenge === undefined) return;
    setBusy(true);
    setError(undefined);
    try {
      const proof = await completeFinancePolicyStepup(context, prepared, challenge.id, code);
      const nextReceipt = await executeFinancePolicyChange(context, prepared, proof);
      setReceipt(nextReceipt);
      await onComplete(nextReceipt);
    } catch (cause) {
      setError(commandError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalOverlay
      className="financedraweroverlay financepolicyworkflowoverlay"
      isOpen={intent !== undefined}
      isDismissable={!busy}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Modal className="financepolicyworkflowmodal">
        <AriaDialog className="financepolicyworkflow" aria-label="财务配置高风险变更">
          {intent === undefined ? null : (
            <>
              <header>
                <div>
                  <p>PREVIEW → LEVEL 3 → PROOF → EXECUTE → REREAD</p>
                  <Heading slot="title">{workflowTitle(intent)}</Heading>
                  <span>
                    {intent.policy.id} · v{intent.policy.version}
                  </span>
                </div>
                <button type="button" onClick={onClose} disabled={busy} aria-label="关闭财务配置工作流">
                  <FinanceIcon name="close" />
                </button>
              </header>

              <div className="financepolicyworkflowbody">
                <section className="financeconfigguard" role="note">
                  <FinanceIcon name="shield" />
                  <p>变更不会原地覆盖历史版本。生效或停用必须由另一位财务复核人审批；服务端将重新验证 Scope、版本、有效期、税率精度与重叠规则。</p>
                </section>

                <label className="financeconfigfield iswide">
                  <span>变更原因</span>
                  <textarea value={reason} maxLength={1000} rows={3} disabled={prepared !== undefined || busy} onChange={(event) => setReason(event.target.value)} />
                </label>

                {prepared === undefined ? (
                  <button className="financeworkflowprimary" type="button" disabled={busy || reason.trim() === ''} onClick={() => void preview()}>
                    生成服务端权威预览
                  </button>
                ) : (
                  <PreviewFacts prepared={prepared} />
                )}

                {prepared !== undefined && challenge === undefined && receipt === undefined ? (
                  <button className="financeworkflowprimary" type="button" disabled={busy} onClick={() => void sendChallenge()}>
                    发送 Level 3 验证码
                  </button>
                ) : null}

                {challenge !== undefined && receipt === undefined ? (
                  <section className="financeworkflowstepup" aria-labelledby="financepolicystepup">
                    <h3 id="financepolicystepup">Level 3 二次验证</h3>
                    <p>验证码有效至 {formatTime(challenge.expires_at)}；验证成功只签发一次性、动作绑定的 proof。</p>
                    <label className="financeconfigfield">
                      <span>6 位验证码</span>
                      <input value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
                    </label>
                    <button className="financeworkflowprimary" type="button" disabled={busy || code.length !== 6} onClick={() => void execute()}>
                      验证并执行本次动作
                    </button>
                  </section>
                ) : null}

                {receipt === undefined ? null : <ReceiptFacts receipt={receipt} />}
                {error === undefined ? null : (
                  <p className="financeconfigerror" role="alert">
                    {error}
                  </p>
                )}
              </div>

              <footer>
                <button type="button" onClick={onClose} disabled={busy}>
                  {receipt === undefined ? '取消' : '完成'}
                </button>
              </footer>
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function PreviewFacts({ prepared }: Readonly<{ prepared: PreparedFinancePolicyChange }>) {
  return (
    <section className="financeworkflowfacts" aria-labelledby="financepolicypreviewfacts">
      <h3 id="financepolicypreviewfacts">服务端预览已生成</h3>
      <dl>
        <div>
          <dt>动作</dt>
          <dd>{prepared.intent.action}</dd>
        </div>
        <div>
          <dt>目标状态</dt>
          <dd>{prepared.intent.desiredState}</dd>
        </div>
        <div>
          <dt>来源版本</dt>
          <dd>v{prepared.preview.sourceVersion}</dd>
        </div>
        <div>
          <dt>有效期</dt>
          <dd>{formatTime(prepared.preview.expiresAt)}</dd>
        </div>
        <div>
          <dt>previewHash</dt>
          <dd>
            <code>{prepared.preview.previewHash}</code>
          </dd>
        </div>
        <div>
          <dt>requestHash</dt>
          <dd>
            <code>{prepared.requestHash}</code>
          </dd>
        </div>
        <div>
          <dt>Idempotency-Key</dt>
          <dd>
            <code>{prepared.idempotencyKey}</code>
          </dd>
        </div>
      </dl>
    </section>
  );
}

function ReceiptFacts({ receipt }: Readonly<{ receipt: FinancePolicyManageReceipt }>) {
  return (
    <section className="financeworkflowreceipt" role="status">
      <FinanceIcon name="check" />
      <div>
        <h3>权威回读完成</h3>
        <p>
          {receipt.policy.id} 已进入 {receipt.policy.state}，版本 v{receipt.policy.version}。
        </p>
        <code>{receipt.policy.revisionHash}</code>
      </div>
    </section>
  );
}

function defaultReason(intent: FinancePolicyWorkflowIntent): string {
  if (intent.action === 'saveDraft' && intent.desiredState === 'retired') return '申请停用财务配置';
  if (intent.action === 'saveDraft') return intent.policy.version === 0 ? '新增财务配置' : '修改财务配置并建立新版本';
  if (intent.action === 'submit') return '提交独立财务复核';
  if (intent.action === 'approve') return '独立复核通过';
  return '独立复核拒绝';
}

function workflowTitle(intent: FinancePolicyWorkflowIntent): string {
  const noun = intent.policy.kind === 'tax' ? '税务规则' : '字段定义';
  if (intent.action === 'approve') return `批准${noun}`;
  if (intent.action === 'reject') return `拒绝${noun}`;
  if (intent.action === 'submit') return `提交${noun}复核`;
  return intent.desiredState === 'retired' ? `申请停用${noun}` : `保存${noun}草稿`;
}

function commandError(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'FINANCE_POLICY_COMMAND_FAILED';
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date(value));
}
