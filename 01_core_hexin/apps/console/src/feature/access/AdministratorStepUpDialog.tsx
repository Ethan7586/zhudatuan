import { Button, Dialog } from '@shop/design';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { ConsoleContext, ConsoleSession } from '../../entity/session/ConsoleSession';
import { completeStepUpAndReadSession, requestStepUp, type StepUpChallenge } from '../../entity/session/StepUpCommand';
import { safeQueryError } from '../../shared/api/QueryState';
import { formatDate } from '../../shared/ui/Format';

export type AdministratorCriticalAction = 'upgrade' | 'demote' | 'offboard';

export function AdministratorStepUpDialog({
  action,
  context,
  targetName,
  onClose,
  onExecute,
}: Readonly<{
  action: AdministratorCriticalAction | undefined;
  context: ConsoleContext;
  targetName: string;
  onClose: () => void;
  onExecute: (session: ConsoleSession) => Promise<void>;
}>) {
  const [challenge, setChallenge] = useState<StepUpChallenge>();
  const [code, setCode] = useState('');
  const requestMutation = useMutation({
    mutationFn: () => requestStepUp(context.session),
    onSuccess: (receipt) => {
      setChallenge(receipt);
      setCode('');
    },
  });
  const executeMutation = useMutation({
    mutationFn: async () => {
      if (challenge === undefined || !/^\d{6}$/.test(code)) throw new Error('STEP_UP_INPUT_INVALID');
      const session = await completeStepUpAndReadSession(context.session, challenge.id, code);
      await onExecute(session);
    },
    onSuccess: onClose,
  });

  const busy = requestMutation.isPending || executeMutation.isPending;
  const error = requestMutation.error ?? executeMutation.error;
  const presentation = action === undefined ? undefined : actionPresentation(action);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!busy && /^\d{6}$/.test(code)) executeMutation.mutate();
  };

  return (
    <Dialog open={action !== undefined} title={presentation?.title ?? '管理员安全验证'} eyebrow="ADMINISTRATOR SECURITY CHECK" dismissable={!busy} onClose={onClose}>
      {presentation === undefined ? null : (
        <form className="administratorstepup" aria-label={presentation.title} onSubmit={submit}>
          <section className="administratorstepupsummary">
            <strong>{targetName}</strong>
            <p>{presentation.impact}</p>
          </section>
          <section className="administratorstepupboundary">
            <strong>验证当前操作人</strong>
            <p>验证码只发送到当前登录管理员已验证的手机号，页面不能指定或更换接收号码。</p>
          </section>
          {challenge === undefined ? (
            <p className="administratorstepupnote">验证成功后，系统才会执行本次操作，并重新读取权威结果。</p>
          ) : (
            <div className="administratorstepupverification">
              <p role="status">验证码已发送，有效期至 {formatDate(challenge.expires_at)}。</p>
              <label htmlFor="administratorstepupcode">
                6 位短信验证码
                <input
                  id="administratorstepupcode"
                  value={code}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  disabled={busy}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                    executeMutation.reset();
                  }}
                />
              </label>
            </div>
          )}
          {error === null ? null : (
            <p className="administratorstepuperror" role="alert">
              {stepUpError(error)}
            </p>
          )}
          <footer className="administratorstepupactions">
            <Button type="button" onPress={onClose} isDisabled={busy}>
              取消
            </Button>
            {challenge === undefined ? (
              <Button type="button" tone="primary" onPress={() => requestMutation.mutate()} isPending={requestMutation.isPending} isDisabled={busy}>
                {requestMutation.isPending ? '正在发送…' : '发送本人短信验证码'}
              </Button>
            ) : (
              <>
                <Button type="button" onPress={() => requestMutation.mutate()} isDisabled={busy}>
                  重新发送验证码
                </Button>
                <Button type="submit" tone="primary" isPending={executeMutation.isPending} isDisabled={busy || !/^\d{6}$/.test(code)}>
                  {executeMutation.isPending ? '正在验证并执行…' : `验证并${presentation.executeLabel}`}
                </Button>
              </>
            )}
          </footer>
        </form>
      )}
    </Dialog>
  );
}

function actionPresentation(action: AdministratorCriticalAction): Readonly<{ title: string; impact: string; executeLabel: string }> {
  if (action === 'upgrade')
    return {
      title: '验证后升级高级管理员',
      impact: '将授予高级管理员角色及当前范围内对应的管理能力，不改变商城会员等级。',
      executeLabel: '升级',
    };
  if (action === 'demote')
    return {
      title: '验证后降级普通管理员',
      impact: '只撤销高级管理员角色，保留普通管理员身份，不改变商城会员等级。',
      executeLabel: '降级',
    };
  return {
    title: '验证后删除管理员',
    impact: '只移除管理身份；商城 L 等级、订单与会员关系不会改变。',
    executeLabel: '移除',
  };
}

function stepUpError(error: Error): string {
  const code = (error as Error & { code?: string }).code;
  if (code === 'STEPUP_CODE_INVALID' || code === 'CHALLENGE_CODE_INVALID') return '验证码不正确，请核对后重试。';
  if (code === 'STEPUP_EXPIRED' || code === 'CHALLENGE_EXPIRED') return '验证码已过期，请关闭后重新发送。';
  if (code === 'STEPUP_REQUIRED') return '安全验证尚未生效，本次操作未执行，请重新获取验证码。';
  if (code === 'MOBILE_NOT_BOUND' || code === 'VERIFIED_MOBILE_REQUIRED') return '当前管理员尚未绑定已验证手机号，暂时不能执行此操作。';
  return safeQueryError(error) ?? '安全验证失败，请稍后重试。';
}
