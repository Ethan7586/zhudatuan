import { Button, Dialog } from '@shop/design';
import { useState, type FormEvent } from 'react';
import type { ConsoleContext, ConsoleScope } from '../../entity/session/ConsoleSession';
import { MallMobileEnrollment } from '../application/MallMobileEnrollment';
import type { AutoNodeTaskReceipt, CreatedMall, MallCreateDraft } from '../application/MallCreateCommand';

export type PlatformCreatePhase = 'form' | 'starting' | 'verification' | 'verifying' | 'creating' | 'success';

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,31}$/;
const OTP_PATTERN = /^\d{6}$/;
const stages = ['平台身份', '继承与入口', '创建确认'] as const;

export function PlatformCreateDialog({
  open,
  phase,
  context,
  enterprises,
  preferredEnterpriseId,
  available,
  sourceLevel,
  targetLevel,
  challengeExpiresAt,
  error,
  result,
  nodeTask,
  nodeTaskError,
  taskRetrying,
  mobileEnrollment,
  onSubmit,
  onVerify,
  onRelogin,
  onRetryNodeTask,
  onClose,
}: Readonly<{
  open: boolean;
  phase: PlatformCreatePhase;
  context: ConsoleContext;
  enterprises: readonly ConsoleScope[];
  preferredEnterpriseId: string | undefined;
  available: boolean;
  sourceLevel: string;
  targetLevel: string | undefined;
  challengeExpiresAt: string | undefined;
  error: string | undefined;
  result: CreatedMall | undefined;
  nodeTask: AutoNodeTaskReceipt | undefined;
  nodeTaskError: string | undefined;
  taskRetrying: boolean;
  mobileEnrollment: boolean;
  onSubmit: (draft: MallCreateDraft) => void;
  onVerify: (code: string) => void;
  onRelogin: () => void;
  onRetryNodeTask: () => void;
  onClose: () => void;
}>) {
  const [stage, setStage] = useState(0);
  const [enterpriseId, setEnterpriseId] = useState(preferredEnterpriseId ?? enterprises[0]?.id ?? '');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const busy = phase === 'starting' || phase === 'verifying' || phase === 'creating';
  const valid = enterpriseId !== '' && name.trim().length > 0 && CODE_PATTERN.test(code) && targetLevel !== undefined;
  const draft: MallCreateDraft = { enterpriseId, name: name.trim(), code, publicSlug: 'auto-h5' };

  return <Dialog
    open={open}
    title={phase === 'success' ? '下级平台创建完成' : phase === 'verification' || phase === 'verifying' ? '验证后创建平台' : '创建下级平台'}
    eyebrow="分布式平台 · 节点生产"
    dismissable={!busy}
    onClose={onClose}
  >
    {mobileEnrollment
      ? <MallMobileEnrollment context={context} onRelogin={onRelogin} />
      : phase === 'success' && result !== undefined
        ? <PlatformCreateSuccess result={result} targetLevel={targetLevel} task={nodeTask ?? result.nodeTask}
            taskError={nodeTaskError} retrying={taskRetrying} onRetry={onRetryNodeTask} onClose={onClose} />
        : phase === 'verification' || phase === 'verifying'
          ? <PlatformVerification
              code={verificationCode}
              expiresAt={challengeExpiresAt}
              busy={busy}
              error={error}
              onCode={setVerificationCode}
              onVerify={onVerify}
              onClose={onClose}
            />
          : <form className="platformcreate" onSubmit={(event) => submit(event, stage, valid, () => onSubmit(draft))}>
              <PlatformCreateProgress stage={stage} />
              {!available ? <p className="platformcreatealert" role="alert">当前账号没有下级平台创建能力，请切换到拥有商城创建权限的管理范围。</p> : null}
              {targetLevel === undefined ? <p className="platformcreatealert" role="alert">当前节点已到最高层级，不能继续创建下级平台。</p> : null}
              {stage === 0 ? <PlatformIdentityStage
                enterprises={enterprises}
                enterpriseId={enterpriseId}
                name={name}
                code={code}
                sourceLevel={sourceLevel}
                targetLevel={targetLevel}
                busy={busy}
                onEnterpriseId={setEnterpriseId}
                onName={setName}
                onCode={setCode}
              /> : null}
              {stage === 1 ? <PlatformInheritanceStage sourceLevel={sourceLevel} targetLevel={targetLevel} /> : null}
              {stage === 2 ? <PlatformReviewStage draft={draft} sourceLevel={sourceLevel} targetLevel={targetLevel} /> : null}
              {error === undefined ? null : <p className="platformcreatealert" role="alert">{error}</p>}
              <footer className="platformcreatefooter">
                <div><strong>{stages[stage]}</strong><span>{stage + 1} / {stages.length}</span></div>
                <nav>
                  <Button onPress={onClose} isDisabled={busy}>取消</Button>
                  {stage > 0 ? <Button onPress={() => setStage(stage - 1)} isDisabled={busy}>上一步</Button> : null}
                  {stage < stages.length - 1
                    ? <Button tone="primary" onPress={() => setStage(stage + 1)} isDisabled={busy || (stage === 0 && !valid)}>下一步</Button>
                    : <Button type="submit" tone="primary" isDisabled={busy || !available || !valid}>{busy ? '创建中' : '确认创建'}</Button>}
                </nav>
              </footer>
            </form>}
  </Dialog>;
}

function PlatformCreateProgress({ stage }: Readonly<{ stage: number }>) {
  return <ol className="platformcreateprogress" aria-label="下级平台创建进度">
    {stages.map((label, index) => <li key={label} data-state={index === stage ? 'current' : index < stage ? 'complete' : 'waiting'}>
      <span>{index < stage ? '✓' : index + 1}</span><strong>{label}</strong>
    </li>)}
  </ol>;
}

function PlatformIdentityStage({
  enterprises,
  enterpriseId,
  name,
  code,
  sourceLevel,
  targetLevel,
  busy,
  onEnterpriseId,
  onName,
  onCode,
}: Readonly<{
  enterprises: readonly ConsoleScope[];
  enterpriseId: string;
  name: string;
  code: string;
  sourceLevel: string;
  targetLevel: string | undefined;
  busy: boolean;
  onEnterpriseId: (value: string) => void;
  onName: (value: string) => void;
  onCode: (value: string) => void;
}>) {
  return <section className="platformcreatestage" aria-labelledby="platformidentitytitle">
    <header><span>STEP 01</span><div><h3 id="platformidentitytitle">确定平台身份</h3><p>名称、代码和上级关系将进入真实商城创建请求。</p></div></header>
    <div className="platformcreatelevel" aria-label="平台层级关系">
      <div><small>当前平台</small><strong>{sourceLevel}</strong></div><i aria-hidden="true">→</i>
      <div data-target="true"><small>下级平台</small><strong>{targetLevel ?? '—'}</strong></div>
    </div>
    <div className="platformcreatefields">
      <label>所属上级
        <select value={enterpriseId} disabled={busy} required onChange={(event) => onEnterpriseId(event.target.value)}>
          <option value="">请选择上级范围</option>
          {enterprises.map((enterprise) => <option key={enterprise.id} value={enterprise.id}>{enterprise.name ?? enterprise.id}</option>)}
        </select>
      </label>
      <label>平台名称
        <input aria-label="平台名称" value={name} disabled={busy} required maxLength={120} placeholder="例如：华中甄选平台" onChange={(event) => onName(event.target.value)} />
      </label>
      <label>平台代码
        <input aria-label="平台代码" value={code} disabled={busy} required maxLength={32} placeholder="例如：HUAZHONG" onChange={(event) => onCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} />
        <small>3–32 位，以字母开头；仅使用大写字母、数字和下划线。</small>
      </label>
    </div>
  </section>;
}

function PlatformInheritanceStage({ sourceLevel, targetLevel }: Readonly<{ sourceLevel: string; targetLevel: string | undefined }>) {
  return <section className="platformcreatestage" aria-labelledby="platforminheritancetitle">
    <header><span>STEP 02</span><div><h3 id="platforminheritancetitle">确认继承与入口</h3><p>只展示本次会真实生成的内容，不收集无落点资料。</p></div></header>
    <div className="platformcreatetemplate" role="group" aria-label="平台创建模板">
      <article data-selected="true"><span aria-hidden="true">✓</span><div><strong>标准托管平台</strong><p>继承当前共享商城内核与 ZHU-VI；建立独立商城身份、商品池和装修草稿。</p></div><b>推荐</b></article>
    </div>
    <dl className="platformcreatefacts">
      <div><dt>层级关系</dt><dd>{sourceLevel} → {targetLevel ?? '—'}</dd></div>
      <div><dt>H5 入口</dt><dd>系统自动分配 h6、h7、h8…</dd></div>
      <div><dt>商城身份</dt><dd>独立商城 ID 与管理范围</dd></div>
      <div><dt>商品空间</dt><dd>独立默认商品池</dd></div>
      <div><dt>视觉体系</dt><dd>继承当前 ZHU-VI</dd></div>
      <div><dt>运行方式</dt><dd>共享内核，独立业务数据</dd></div>
    </dl>
    <p className="platformcreatenext">商城核心创建后将立即进入独立节点生产队列；外部资源未就绪时会保留任务并明确显示等待项。</p>
  </section>;
}

function PlatformReviewStage({ draft, sourceLevel, targetLevel }: Readonly<{
  draft: MallCreateDraft;
  sourceLevel: string;
  targetLevel: string | undefined;
}>) {
  return <section className="platformcreatestage" aria-labelledby="platformreviewtitle">
    <header><span>STEP 03</span><div><h3 id="platformreviewtitle">核对创建内容</h3><p>商城核心原子提交；节点生产由同一任务持续衔接。</p></div></header>
    <section className="platformcreatereviewhero">
      <div><small>即将创建</small><h3>{draft.name || '未填写平台名称'}</h3><p>{draft.code || '—'} · {sourceLevel} → {targetLevel ?? '—'}</p></div>
      <span>标准托管平台</span>
    </section>
    <dl className="platformcreatefacts">
      <div><dt>上级范围</dt><dd>{draft.enterpriseId || '—'}</dd></div>
      <div><dt>H5 地址</dt><dd>创建后返回真实分配结果</dd></div>
      <div><dt>创建组织</dt><dd>下级商城组织与 Owner 范围</dd></div>
      <div><dt>创建应用</dt><dd>首页草稿与首个有效版本</dd></div>
      <div><dt>创建商品池</dt><dd>独立默认商品池</dd></div>
      <div><dt>发布状态</dt><dd>草稿，不自动公开</dd></div>
    </dl>
  </section>;
}

function PlatformVerification({ code, expiresAt, busy, error, onCode, onVerify, onClose }: Readonly<{
  code: string;
  expiresAt: string | undefined;
  busy: boolean;
  error: string | undefined;
  onCode: (value: string) => void;
  onVerify: (code: string) => void;
  onClose: () => void;
}>) {
  return <form className="platformcreate platformcreateverification" onSubmit={(event) => {
    event.preventDefault();
    if (OTP_PATTERN.test(code)) onVerify(code);
  }}>
    <section className="platformcreatestage">
      <header><span>身份确认</span><div><h3>输入六位验证码</h3><p>验证成功后立即继续刚才的平台创建请求。</p></div></header>
      {expiresAt === undefined ? null : <p className="platformcreateexpiry">验证码有效期至 {formatExpiry(expiresAt)}</p>}
      <label>六位验证码
        <input aria-label="六位验证码" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6}
          disabled={busy} onChange={(event) => onCode(event.target.value.replace(/\D/g, ''))} />
      </label>
      {error === undefined ? null : <p className="platformcreatealert" role="alert">{error}</p>}
    </section>
    <footer className="platformcreatefooter"><span /><nav><Button onPress={onClose} isDisabled={busy}>取消</Button>
      <Button type="submit" tone="primary" isDisabled={busy || !OTP_PATTERN.test(code)}>{busy ? '验证并创建中' : '验证并创建'}</Button></nav></footer>
  </form>;
}

function PlatformCreateSuccess({ result, targetLevel, task, taskError, retrying, onRetry, onClose }: Readonly<{
  result: CreatedMall;
  targetLevel: string | undefined;
  task: AutoNodeTaskReceipt;
  taskError: string | undefined;
  retrying: boolean;
  onRetry: () => void;
  onClose: () => void;
}>) {
  return <section className="platformcreate platformcreatesuccess">
    <div className="platformcreatesuccessmark" aria-hidden="true">✓</div>
    <header><span>平台核心已建立</span><h3>{result.name}</h3><p>{nodeTaskHeadline(task)}</p></header>
    <dl className="platformcreatefacts">
      <div><dt>目标层级</dt><dd>{targetLevel ?? '—'}</dd></div>
      <div><dt>平台代码</dt><dd>{result.code}</dd></div>
      <div><dt>H5 地址</dt><dd>{result.publicSlug}.hbbtzn.com</dd></div>
      <div><dt>商城 ID</dt><dd>{result.mallId}</dd></div>
      <div><dt>商品池</dt><dd>{result.poolId}</dd></div>
      <div><dt>发布状态</dt><dd>草稿</dd></div>
    </dl>
    <section className="platformcreatetask" aria-live="polite">
      <header><div><small>独立节点生产</small><strong>{nodeTaskStatus(task.status)}</strong></div><b>{task.progress}%</b></header>
      <div className="platformcreatetaskbar" role="progressbar" aria-label="独立节点生产进度"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={task.progress}><i style={{ width: `${task.progress}%` }} /></div>
      <p>{task.events.at(-1)?.message ?? '正在读取节点生产进度'}</p>
      {task.waiting_external.length === 0 ? null : <ul>{task.waiting_external.map((item) => <li key={item}>{waitingLabel(item)}</li>)}</ul>}
      {task.last_error === null ? null : <p className="platformcreatealert" role="alert">{task.last_error.message}</p>}
      {taskError === undefined ? null : <p className="platformcreatealert" role="alert">进度读取失败：{taskError}</p>}
    </section>
    <footer className="platformcreatefooter"><span>{task.node_id}</span><nav>
      {task.status === 'WAITING_EXTERNAL' || task.status === 'FAILED_RETRYABLE'
        ? <Button onPress={onRetry} isDisabled={retrying}>{retrying ? '重新提交中' : '重试节点生产'}</Button> : null}
      <Button tone="primary" onPress={onClose}>完成并查看</Button>
    </nav></footer>
  </section>;
}

function nodeTaskStatus(status: AutoNodeTaskReceipt['status']): string {
  return {
    QUEUED: '已进入队列',
    RUNNING: '正在生产',
    WAITING_EXTERNAL: '等待外部资源',
    FAILED_RETRYABLE: '生产暂停，可重试',
    SUCCEEDED: '独立节点已激活',
  }[status];
}

function nodeTaskHeadline(task: AutoNodeTaskReceipt): string {
  if (task.status === 'SUCCEEDED') return '独立 API、身份域、NodeManifest 和发布指针均已激活。';
  if (task.status === 'WAITING_EXTERNAL') return '商城数据已完成，节点任务已安全保留，补齐外部资源后可继续。';
  if (task.status === 'FAILED_RETRYABLE') return '商城数据已完成，节点生产暂时停止，可从当前任务继续重试。';
  return '商城数据已完成，独立节点正在后台生产，无需停留等待。';
}

function waitingLabel(value: string): string {
  const labels: Readonly<Record<string, string>> = {
    'runtime-profile': '等待节点运行配置',
    'immutable-release': '等待不可变运行制品',
  };
  return labels[value] ?? value;
}

function submit(event: FormEvent<HTMLFormElement>, stage: number, valid: boolean, onSubmit: () => void) {
  event.preventDefault();
  if (stage === stages.length - 1 && valid) onSubmit();
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
