<<<<<<< HEAD
import { Button, Dialog, Form } from '@shop/design';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { safeQueryError } from '../../shared/api/QueryState';
import { formatDate } from '../../shared/ui/Format';
import { copyApplication, createApplication, disableApplication, editApplication } from './ApplicationCommand';
import { applicationStatusLabel, applicationStatusTone, publicationLabel, validationLabel, validationTone } from './ApplicationPresentation';
import { ApplicationCopyDraftSchema, ApplicationCreateDraftSchema, ApplicationEditDraftSchema, type Application } from './ApplicationSchema';
import type { CommerceScopePresentation, CommerceWorkspaceMode } from './ApplicationScope';

export function ApplicationRecordDrawer({
  record,
  canEdit,
  canCopy,
  onEdit,
  onCopy,
  onDisable,
  onClose,
}: Readonly<{
  record: Application | undefined;
  canEdit: boolean;
  canCopy: boolean;
  onEdit: (record: Application) => void;
  onCopy: (record: Application) => void;
  onDisable: (record: Application) => void;
=======
import { useEffect, useRef, type RefObject } from 'react';
import { formatDate } from '../../shared/ui/Format';
import {
  applicationStatusLabel,
  applicationStatusTone,
  publicationLabel,
  validationLabel,
  validationTone,
} from './ApplicationPresentation';
import type { Application } from './ApplicationSchema';
import type { CommerceScopePresentation, CommerceWorkspaceMode } from './ApplicationScope';

export function ApplicationRecordDrawer({ record, onClose }: Readonly<{
  record: Application | undefined;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  onClose: () => void;
}>) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogKeyboard(record !== undefined, onClose, closeRef);
  if (record === undefined) return null;
<<<<<<< HEAD
  return (
    <div className="commerceoverlay is-drawer">
      <button className="commercedialogbackdrop" type="button" onClick={onClose} aria-label="关闭商城应用摘要" />
      <aside className="commercedrawer" role="dialog" aria-modal="true" aria-labelledby="commercedrawertitle">
        <header>
          <div>
            <p>COMMERCE APPLICATION · 只读摘要</p>
            <h2 id="commercedrawertitle">{record.name}</h2>
            <code>{record.id}</code>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭商城应用摘要">
            ×
          </button>
        </header>
        <div className="commercedrawerbody">
          <section className="commercedrawerstatus">
            <span className={`commercestate is-${applicationStatusTone(record.status)}`}>
              <i aria-hidden="true" />
              {applicationStatusLabel(record.status)}
            </span>
            <span className={`commercestate is-${validationTone(record.head_validation_state)}`}>
              <i aria-hidden="true" />
              {validationLabel(record.head_validation_state)}
            </span>
            <p>这里只展示 experience.applications.read 已返回的权威字段，不推断页面配置或审核结论。</p>
          </section>
          <dl className="commercefacts">
            <div>
              <dt>应用代码</dt>
              <dd>{record.code}</dd>
            </div>
            <div>
              <dt>公开路径</dt>
              <dd>/{record.public_slug}</dd>
            </div>
            <div>
              <dt>商城绑定</dt>
              <dd>{record.mall_id ?? '尚未绑定'}</dd>
            </div>
            <div>
              <dt>商品池绑定</dt>
              <dd>{record.pool_id ?? '尚未绑定'}</dd>
            </div>
            <div>
              <dt>当前草稿</dt>
              <dd>{record.head_sequence === null || record.head_sequence === undefined ? '尚未建立' : `v${record.head_sequence}`}</dd>
            </div>
            <div>
              <dt>发布版本</dt>
              <dd>{publicationLabel(record)}</dd>
            </div>
            <div>
              <dt>绑定域名</dt>
              <dd>{record.domain ?? '尚未绑定'}</dd>
            </div>
            <div>
              <dt>更新时间</dt>
              <dd>{formatDate(record.updated_at)}</dd>
            </div>
          </dl>
          <section className="commercewriteboundary" role="note">
            <strong>操作边界</strong>
            <p>摘要本身不会提交任何写操作；编辑和停用必须携带当前 expectedVersion，复制只复制当前草稿版本，不会发布或覆盖源应用。</p>
          </section>
        </div>
        <footer>
          {canEdit ? (
            <button type="button" onClick={() => onEdit(record)}>
              编辑
            </button>
          ) : null}
          {canCopy ? (
            <button type="button" onClick={() => onCopy(record)}>
              复制
            </button>
          ) : null}
          {canEdit ? (
            <>
              {record.status.toLowerCase() === 'disabled' ? null : (
                <button type="button" onClick={() => onDisable(record)}>
                  停用
                </button>
              )}
            </>
          ) : null}
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </footer>
      </aside>
    </div>
  );
}

interface ApplicationDialogProps {
  readonly context: ConsoleContext;
  readonly onClose: () => void;
  readonly onSuccess: (notice: string) => Promise<void>;
}

export function ApplicationCreateDialog({ context, onClose, onSuccess }: Readonly<ApplicationDialogProps>) {
  const [validationError, setValidationError] = useState<string>();
  const mutation = useMutation({
    mutationFn: (draft: Parameters<typeof createApplication>[1]) => createApplication(context, draft),
    onSuccess: () => onSuccess('应用创建成功。'),
  });
  const close = () => {
    if (!mutation.isPending) onClose();
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(undefined);
    const form = new FormData(event.currentTarget);
    const draft = ApplicationCreateDraftSchema.safeParse({
      name: form.get('name'),
      code: form.get('code'),
      publicSlug: form.get('publicSlug'),
    });
    if (!draft.success) {
      setValidationError('请检查应用名称、应用代码和公开路径。');
      return;
    }
    mutation.mutate(draft.data);
  };

  return (
    <Dialog open title="新建应用" eyebrow="APPLICATION CREATE" dismissable={!mutation.isPending} onClose={close}>
      <Form className="command" label="新建应用" onSubmit={submit}>
        <p className="commandhint">这里只创建 Application 记录，不会创建商城、组织关系、商品池或装修版本。</p>
        <label>
          应用名称
          <input name="name" minLength={1} maxLength={255} required />
        </label>
        <label>
          应用代码
          <input name="code" pattern="[A-Z][A-Z0-9_]{2,31}" minLength={3} maxLength={32} placeholder="NEW_APP" required />
        </label>
        <label>
          公开路径
          <input name="publicSlug" pattern="[a-z0-9][a-z0-9-]{2,47}" minLength={3} maxLength={48} placeholder="new-app" required />
        </label>
        <CommandError validationError={validationError} error={mutation.error} />
        <footer>
          <Button onPress={close} isDisabled={mutation.isPending}>
            取消
          </Button>
          <Button type="submit" tone="primary" isPending={mutation.isPending}>
            {mutation.isPending ? '正在创建…' : '创建应用'}
          </Button>
        </footer>
      </Form>
    </Dialog>
  );
}

export function ApplicationEditDialog({ context, record, onClose, onSuccess }: Readonly<ApplicationDialogProps & { record: Application }>) {
  const [validationError, setValidationError] = useState<string>();
  const mutation = useMutation({
    mutationFn: (draft: Parameters<typeof editApplication>[3]) => editApplication(context, record.id, record.version, draft),
    onSuccess: () => onSuccess('应用名称修改成功。'),
  });
  const close = () => {
    if (!mutation.isPending) onClose();
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(undefined);
    const draft = ApplicationEditDraftSchema.safeParse({ name: new FormData(event.currentTarget).get('name') });
    if (!draft.success) {
      setValidationError('请输入有效的应用名称。');
      return;
    }
    mutation.mutate(draft.data);
  };

  return (
    <Dialog open title={`编辑应用 · ${record.name}`} eyebrow="APPLICATION UPDATE" dismissable={!mutation.isPending} onClose={close}>
      <Form className="command" label={`编辑${record.name}`} onSubmit={submit}>
        <p className="commandhint">本批只修改应用名称；请求会携带当前版本 {record.version}。</p>
        <label>
          应用名称
          <input name="name" defaultValue={record.name} minLength={1} maxLength={255} required />
        </label>
        <CommandError validationError={validationError} error={mutation.error} />
        <footer>
          <Button onPress={close} isDisabled={mutation.isPending}>
            取消
          </Button>
          <Button type="submit" tone="primary" isPending={mutation.isPending}>
            {mutation.isPending ? '正在保存…' : '保存名称'}
          </Button>
        </footer>
      </Form>
    </Dialog>
  );
}

export function ApplicationCopyDialog({ context, record, onClose, onSuccess }: Readonly<ApplicationDialogProps & { record: Application }>) {
  const [validationError, setValidationError] = useState<string>();
  const copyable = record.head_sequence !== null && record.head_sequence !== undefined;
  const mutation = useMutation({
    mutationFn: (draft: Parameters<typeof copyApplication>[2]) => copyApplication(context, record.id, draft),
    onSuccess: () => onSuccess('应用复制成功。'),
  });
  const close = () => {
    if (!mutation.isPending) onClose();
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(undefined);
    if (!copyable) {
      setValidationError('当前应用尚无可复制的草稿版本。');
      return;
    }
    const form = new FormData(event.currentTarget);
    const draft = ApplicationCopyDraftSchema.safeParse({
      name: form.get('name'),
      code: form.get('code'),
      publicSlug: form.get('publicSlug'),
      reason: form.get('reason'),
    });
    if (!draft.success) {
      setValidationError('请检查副本名称、新代码、新公开路径和复制原因。');
      return;
    }
    if (draft.data.code === record.code || draft.data.publicSlug === record.public_slug) {
      setValidationError('新 code 和新 publicSlug 不能与源应用相同。');
      return;
    }
    mutation.mutate(draft.data);
  };

  return (
    <Dialog open title={`复制应用 · ${record.name}`} eyebrow="APPLICATION COPY" dismissable={!mutation.isPending} onClose={close}>
      <Form className="command" label={`复制${record.name}`} onSubmit={submit}>
        <dl className="commercefacts">
          <div>
            <dt>源应用</dt>
            <dd>{record.name}</dd>
          </div>
          <div>
            <dt>应用代码</dt>
            <dd>{record.code}</dd>
          </div>
          <div>
            <dt>公开路径</dt>
            <dd>/{record.public_slug}</dd>
          </div>
          <div>
            <dt>当前草稿版本</dt>
            <dd>{copyable ? `v${record.head_sequence}` : '尚未建立'}</dd>
          </div>
        </dl>
        {copyable ? null : <p role="alert">当前应用尚无可复制的草稿版本。</p>}
        <label>
          副本名称
          <input name="name" minLength={1} maxLength={255} required disabled={!copyable} />
        </label>
        <label>
          新 code
          <input name="code" pattern="[A-Z][A-Z0-9_]{2,31}" minLength={3} maxLength={32} required disabled={!copyable} />
        </label>
        <label>
          新 publicSlug
          <input name="publicSlug" pattern="[a-z0-9][a-z0-9-]{2,47}" minLength={3} maxLength={48} required disabled={!copyable} />
        </label>
        <label>
          复制原因
          <textarea name="reason" maxLength={500} rows={3} required disabled={!copyable} />
        </label>
        <CommandError validationError={validationError} error={mutation.error} />
        <footer>
          <Button onPress={close} isDisabled={mutation.isPending}>
            取消
          </Button>
          <Button type="submit" tone="primary" isDisabled={!copyable} isPending={mutation.isPending}>
            {mutation.isPending ? '正在复制…' : '复制应用'}
          </Button>
        </footer>
      </Form>
    </Dialog>
  );
}

export function ApplicationDisableDialog({ context, record, onClose, onSuccess }: Readonly<ApplicationDialogProps & { record: Application }>) {
  const mutation = useMutation({
    mutationFn: () => disableApplication(context, record.id, record.version),
    onSuccess: () => onSuccess('应用已停用。'),
  });
  const close = () => {
    if (!mutation.isPending) onClose();
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open title={`停用应用 · ${record.name}`} eyebrow="APPLICATION DISABLE" dismissable={!mutation.isPending} onClose={close}>
      <Form className="command" label={`停用${record.name}`} onSubmit={submit}>
        <dl className="commercefacts">
          <div>
            <dt>应用名称</dt>
            <dd>{record.name}</dd>
          </div>
          <div>
            <dt>当前状态</dt>
            <dd>{applicationStatusLabel(record.status)}</dd>
          </div>
        </dl>
        <section className="commercewriteboundary" role="note">
          <strong>停用确认</strong>
          <p>停用后应用不再作为正常经营应用使用，历史版本和审计记录不会删除。</p>
        </section>
        <CommandError error={mutation.error} />
        <footer>
          <Button onPress={close} isDisabled={mutation.isPending}>
            取消
          </Button>
          <Button type="submit" tone="danger" isPending={mutation.isPending}>
            {mutation.isPending ? '正在停用…' : '确认停用'}
          </Button>
        </footer>
      </Form>
    </Dialog>
  );
}

function CommandError({ validationError, error }: Readonly<{ validationError?: string | undefined; error: Error | null }>) {
  if (validationError === undefined && error === null) return null;
  const safe = error === null ? undefined : safeQueryError(error);
  const message = safe?.startsWith('VERSION_CONFLICT') ? 'VERSION_CONFLICT · 数据已经变化，请刷新后重试。' : (validationError ?? `${safe ?? 'REQUEST_FAILED'} · 操作失败，请重试。`);
  return <p role="alert">{message}</p>;
}

export function CommerceFlowPreview({
  open,
  presentation,
  onClose,
}: Readonly<{
=======
  return <div className="commerceoverlay is-drawer">
    <button className="commercedialogbackdrop" type="button" onClick={onClose} aria-label="关闭商城应用摘要" />
    <aside className="commercedrawer" role="dialog" aria-modal="true" aria-labelledby="commercedrawertitle">
      <header><div><p>COMMERCE APPLICATION · 只读摘要</p><h2 id="commercedrawertitle">{record.name}</h2><code>{record.id}</code></div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭商城应用摘要">×</button></header>
      <div className="commercedrawerbody">
        <section className="commercedrawerstatus">
          <span className={`commercestate is-${applicationStatusTone(record.status)}`}><i aria-hidden="true" />{applicationStatusLabel(record.status)}</span>
          <span className={`commercestate is-${validationTone(record.head_validation_state)}`}><i aria-hidden="true" />{validationLabel(record.head_validation_state)}</span>
          <p>这里只展示 experience.applications.read 已返回的权威字段，不推断页面配置或审核结论。</p>
        </section>
        <dl className="commercefacts">
          <div><dt>应用代码</dt><dd>{record.code}</dd></div>
          <div><dt>公开路径</dt><dd>/{record.public_slug}</dd></div>
          <div><dt>商城绑定</dt><dd>{record.mall_id ?? '尚未绑定'}</dd></div>
          <div><dt>商品池绑定</dt><dd>{record.pool_id ?? '尚未绑定'}</dd></div>
          <div><dt>当前草稿</dt><dd>{record.head_sequence === null || record.head_sequence === undefined ? '尚未建立' : `v${record.head_sequence}`}</dd></div>
          <div><dt>发布版本</dt><dd>{publicationLabel(record)}</dd></div>
          <div><dt>绑定域名</dt><dd>{record.domain ?? '尚未绑定'}</dd></div>
          <div><dt>更新时间</dt><dd>{formatDate(record.updated_at)}</dd></div>
        </dl>
        <section className="commercewriteboundary" role="note"><strong>安全边界</strong><p>编辑、校验、发布与恢复需要 expectedVersion、Preview 和操作证明；当前抽屉不会提交任何写操作。</p></section>
      </div>
      <footer><button type="button" onClick={onClose}>关闭</button></footer>
    </aside>
  </div>;
}

export function CommerceFlowPreview({ open, presentation, onClose }: Readonly<{
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  open: boolean;
  presentation: CommerceScopePresentation;
  onClose: () => void;
}>) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogKeyboard(open, onClose, closeRef);
  if (!open) return null;
  const copy = previewCopy(presentation.mode);
<<<<<<< HEAD
  return (
    <div className="commerceoverlay">
      <button className="commercedialogbackdrop" type="button" onClick={onClose} aria-label={`关闭${copy.title}`} />
      <section className="commerceflowdialog" role="dialog" aria-modal="true" aria-labelledby="commerceflowtitle">
        <header>
          <div>
            <p>SAFE FLOW PREVIEW</p>
            <h2 id="commerceflowtitle">{copy.title}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={`关闭${copy.title}`}>
            ×
          </button>
        </header>
        <div className="commerceflowbody">
          <p className="commerceflownotice">{copy.notice}</p>
          <ol>
            {copy.steps.map((step, index) => (
              <li key={step[0]}>
                <span>{index + 1}</span>
                <div>
                  <strong>{step[0]}</strong>
                  <p>{step[1]}</p>
                </div>
              </li>
            ))}
          </ol>
          <section className="commercewriteboundary" role="note">
            <strong>{copy.boundaryTitle}</strong>
            <p>{copy.boundary}</p>
          </section>
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            返回{presentation.title}
          </button>
        </footer>
      </section>
    </div>
  );
=======
  return <div className="commerceoverlay">
    <button className="commercedialogbackdrop" type="button" onClick={onClose} aria-label={`关闭${copy.title}`} />
    <section className="commerceflowdialog" role="dialog" aria-modal="true" aria-labelledby="commerceflowtitle">
      <header><div><p>SAFE FLOW PREVIEW</p><h2 id="commerceflowtitle">{copy.title}</h2></div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label={`关闭${copy.title}`}>×</button></header>
      <div className="commerceflowbody">
        <p className="commerceflownotice">{copy.notice}</p>
        <ol>{copy.steps.map((step, index) => <li key={step[0]}><span>{index + 1}</span><div><strong>{step[0]}</strong><p>{step[1]}</p></div></li>)}</ol>
        <section className="commercewriteboundary" role="note"><strong>{copy.boundaryTitle}</strong><p>{copy.boundary}</p></section>
      </div>
      <footer><button type="button" onClick={onClose}>返回{presentation.title}</button></footer>
    </section>
  </div>;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

interface PreviewCopy {
  readonly title: string;
  readonly notice: string;
  readonly boundaryTitle: string;
  readonly boundary: string;
  readonly steps: readonly (readonly [string, string])[];
}

function previewCopy(mode: CommerceWorkspaceMode): PreviewCopy {
<<<<<<< HEAD
  if (mode === 'management')
    return {
      title: '创建商城 · 六步安全预览',
      notice: '这是已确认的集团建店路径预览；所有步骤都可查看，但现在不会写入商城、组织关系、商品池或应用。',
      boundaryTitle: '等待原子化 mall.bootstrap',
      boundary: '必须由服务端一次完成 disabled Mall、组织层级、商城 Application、初始商品池和开店草稿；任何一步失败都要整体回滚。',
      steps: [
        ['商城信息', '名称、业务类型、负责人和经营范围'],
        ['主体与准入', '集团归属、资质状态与平台审核边界'],
        ['商品与供应', '建立初始商品池并明确供应链范围'],
        ['交易与履约', '配置支付、售后、配送与服务承诺'],
        ['店铺装修', '选择模板、页面结构、导航与品牌资产'],
        ['检查并建立', '预览配置，原子创建后切换至新商城 Scope'],
      ],
    };
  if (mode === 'design')
    return {
      title: '店铺装修 · 安全预览',
      notice: '当前商城可沿此路径完成消费入口设计；本预览不会保存草稿、校验引用或发布版本。',
      boundaryTitle: '发布旅程保持关闭',
      boundary: '装修提交必须带 expectedVersion，经服务端校验商品、资产、动作与绑定，再通过 Preview / proof 进入可恢复发布。',
      steps: [
        ['页面结构', '首页、分类页、频道页与活动页'],
        ['品牌模板', '颜色、字体、卡片和视觉资产'],
        ['导航路径', '底部导航、频道入口和购买动线'],
        ['安全预览', '校验商品引用、动作和商城绑定'],
        ['发布上线', '生成新版本并保留恢复点'],
      ],
    };
=======
  if (mode === 'management') return {
    title: '创建商城 · 六步安全预览',
    notice: '这是已确认的集团建店路径预览；所有步骤都可查看，但现在不会写入商城、组织关系、商品池或应用。',
    boundaryTitle: '等待原子化 mall.bootstrap',
    boundary: '必须由服务端一次完成 disabled Mall、组织层级、商城 Application、初始商品池和开店草稿；任何一步失败都要整体回滚。',
    steps: [
      ['商城信息', '名称、业务类型、负责人和经营范围'],
      ['主体与准入', '集团归属、资质状态与平台审核边界'],
      ['商品与供应', '建立初始商品池并明确供应链范围'],
      ['交易与履约', '配置支付、售后、配送与服务承诺'],
      ['店铺装修', '选择模板、页面结构、导航与品牌资产'],
      ['检查并建立', '预览配置，原子创建后切换至新商城 Scope'],
    ],
  };
  if (mode === 'design') return {
    title: '店铺装修 · 安全预览',
    notice: '当前商城可沿此路径完成消费入口设计；本预览不会保存草稿、校验引用或发布版本。',
    boundaryTitle: '发布旅程保持关闭',
    boundary: '装修提交必须带 expectedVersion，经服务端校验商品、资产、动作与绑定，再通过 Preview / proof 进入可恢复发布。',
    steps: [
      ['页面结构', '首页、分类页、频道页与活动页'],
      ['品牌模板', '颜色、字体、卡片和视觉资产'],
      ['导航路径', '底部导航、频道入口和购买动线'],
      ['安全预览', '校验商品引用、动作和商城绑定'],
      ['发布上线', '生成新版本并保留恢复点'],
    ],
  };
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  return {
    title: '商城准入 · 治理边界',
    notice: '平台在这里查看跨商城应用与异常；商户建店和装修仍在所属集团与商城 Scope 内完成。',
    boundaryTitle: '平台不能代替商户自审',
    boundary: '正式准入应进入“系统治理 → 商城准入”，记录审核人、结论和证据；当前应用治理页仅提供只读态势。',
    steps: [
      ['提交准入', '集团提交主体、经营范围与商城草稿'],
      ['平台复核', '独立审核资质、风险与范围'],
      ['启用商城', '审核通过后激活商城运行边界'],
      ['持续治理', '监测应用、域名、发布与异常状态'],
    ],
  };
}

function useDialogKeyboard(open: boolean, onClose: () => void, focusRef: RefObject<HTMLButtonElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusRef.current?.focus();
<<<<<<< HEAD
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      previous?.focus();
    };
=======
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('keydown', closeOnEscape); previous?.focus(); };
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  }, [focusRef, onClose, open]);
}
