import { useMutation, useQuery } from '@tanstack/react-query';
import { createFetchExperience } from '@shop/sdk/experience';
import { useState, type FormEvent } from 'react';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { experienceCopyIdentity } from './ExperienceCopy';
import type { Experience } from './ExperienceSchema';
import type { ExperienceDetail } from './ExperienceSchema';
import { applicationDetailKey, readExperienceDetail } from './ExperienceQuery';

const commands = createFetchExperience(appConfig.apiBaseUrl);

export type ExperienceAction = Readonly<{ kind: 'create' }> | Readonly<{ kind: 'copy' | 'manage' | 'design'; record: Experience }>;

export function ExperienceActionDialog({ action, context, onClose, onDone }: Readonly<{ action: ExperienceAction | null; context: ConsoleContext; onClose: () => void; onDone: () => void }>) {
  const application = action !== null && action.kind === 'design' ? action.record.id : '';
  const detail = useQuery({ queryKey: applicationDetailKey(context, application || 'closed'), queryFn: ({ signal }) => readExperienceDetail(context, application, signal), enabled: application !== '', staleTime: 30_000 });
  if (action === null) return null;
  if (action.kind === 'design' && (detail.isPending || detail.isError || !detail.data)) return <ExperienceLoading failed={detail.isError} onClose={onClose} />;
  return <ExperienceActionForm key={`${action.kind}:${'record' in action ? action.record.id : 'new'}`} action={action} detail={detail.data} context={context} onClose={onClose} onDone={onDone} />;
}

function ExperienceActionForm({ action, detail, context, onClose, onDone }: Readonly<{ action: ExperienceAction; detail: ExperienceDetail | undefined; context: ConsoleContext; onClose: () => void; onDone: () => void }>) {
  const record = 'record' in action ? action.record : undefined;
  const [copyIdentity] = useState(() => (action.kind === 'copy' ? experienceCopyIdentity(action.record) : undefined));
  const [name, setName] = useState(copyIdentity?.name ?? record?.name ?? '主打团员工福利商城');
  const [code, setCode] = useState(copyIdentity?.code ?? 'ZHUDATUAN_EMPLOYEE');
  const [slug, setSlug] = useState(copyIdentity?.slug ?? 'zhudatuan-employee');
  const [status, setStatus] = useState(record?.status ?? 'draft');
  const currentContent = experienceContent(detail, record);
  const [title, setTitle] = useState(currentContent.title);
  const [announcement, setAnnouncement] = useState(currentContent.announcement);
  const mutation = useMutation({
    mutationFn: async () => {
      const request = commandContext(context, record?.version);
      if (action.kind === 'create') return commands.applicationsCreate({ body: { code, publicSlug: slug, name } }, request);
      if (action.kind === 'copy') return commands.applicationsCopy({ path: { applicationid: action.record.id }, body: { code, publicSlug: slug, name, reason: '控制台复制商城应用' } }, request);
      if (action.kind === 'manage') return commands.applicationsUpdate({ path: { applicationid: action.record.id }, body: { name, status } }, request);
      const configuration = {
        version: 2 as const,
        application: action.record.id,
        pages: [
          {
            id: `${action.record.id}:home`,
            path: 'home',
            blocks: [
              { id: `${action.record.id}:home:hero`, component: 'hero' as const, content: { title, subtitle: '企业福利，温暖抵达' } },
              { id: `${action.record.id}:home:notice`, component: 'notice' as const, content: { announcement } },
            ],
          },
        ],
      };
      const saved = await commands.versionsSave({ path: { applicationid: action.record.id }, body: { schemaVersion: 2, configuration, reason: '控制台商城装修发布' } }, commandContext(context, action.record.version));
      await commands.versionsValidate({ path: { versionid: saved.id }, body: {} }, commandContext(context));
      return commands.versionsPublish({ path: { versionid: saved.id }, body: {} }, commandContext(context, action.record.version + 1));
    },
    onSuccess: onDone,
  });
  const restore = useMutation({
    mutationFn: async () => {
      if (record === undefined) throw new Error('EXPERIENCE_RECORD_REQUIRED');
      const source = detail?.history.find((version) => version.id !== detail.head?.id) ?? detail?.history[0];
      if (source === undefined) throw new Error('EXPERIENCE_HISTORY_REQUIRED');
      const restored = await commands.versionsRestore({ path: { versionid: source.id }, body: { reason: '控制台恢复历史装修版本' } }, commandContext(context, record.version));
      return commands.versionsPublish({ path: { versionid: restored.id }, body: {} }, commandContext(context, record.version + 1));
    },
    onSuccess: onDone,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };
  const pending = mutation.isPending || restore.isPending;
  const failure = mutation.error ?? restore.error;
  return (
    <div className="commerceoverlay">
      <button className="commercedialogbackdrop" type="button" onClick={onClose} aria-label="关闭操作窗口" />
      <form className="commerceflowdialog" aria-label={actionTitle(action.kind)} onSubmit={submit}>
        <header>
          <div>
            <p>COMMERCE APPLICATION</p>
            <h2>{actionTitle(action.kind)}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭操作窗口">
            ×
          </button>
        </header>
        <div className="commerceflowbody commerceactionform">
          {action.kind === 'design' ? (
            <>
              <label>
                首页主标题
                <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={80} />
              </label>
              <label>
                公告文案
                <textarea value={announcement} onChange={(event) => setAnnouncement(event.target.value)} required maxLength={240} />
              </label>
              <section className="commercepreview" aria-label="商城装修预览">
                <strong>{title}</strong>
                <p>{announcement}</p>
              </section>
              <p className="commerceflownotice">保存后依次执行版本校验、发布和应用启用；任一步失败都不会覆盖当前已发布版本。</p>
            </>
          ) : (
            <>
              <label>
                商城名称
                <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
              </label>
              {action.kind !== 'manage' ? (
                <label>
                  应用代码
                  <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required pattern="[A-Z][A-Z0-9_]{2,31}" />
                </label>
              ) : null}
              {action.kind !== 'manage' ? (
                <label>
                  公开路径
                  <input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} required pattern="[a-z0-9][a-z0-9-]{2,47}" />
                </label>
              ) : null}
              {action.kind === 'manage' ? (
                <label>
                  经营状态
                  <select value={status} onChange={(event) => setStatus(event.target.value as Experience['status'])}>
                    <option value="draft">草稿</option>
                    <option value="active">经营中</option>
                    <option value="disabled">已停用</option>
                  </select>
                </label>
              ) : null}
            </>
          )}
          {failure === null ? null : (
            <p role="alert" className="commerceactionerror">
              {failure.message}
            </p>
          )}
        </div>
        <footer className="commerceactionfooter">
          {action.kind === 'design' && (detail?.history.length ?? 0) > 1 ? (
            <button type="button" onClick={() => restore.mutate()} disabled={pending}>
              恢复上一版本并发布
            </button>
          ) : null}
          <button type="submit" disabled={pending}>
            {pending ? '正在提交…' : actionSubmit(action.kind)}
          </button>
        </footer>
      </form>
    </div>
  );
}

function commandContext(context: ConsoleContext, expectedVersion?: number) {
  return consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
  });
}

function experienceContent(detail: ExperienceDetail | undefined, record: Experience | undefined): Readonly<{ title: string; announcement: string }> {
  if (detail?.head?.configuration === null || detail?.head?.configuration === undefined || typeof detail.head.configuration !== 'object') {
    return { title: record?.name ?? '主打团福利商城', announcement: '欢迎进入企业福利商城' };
  }
  const source = detail.head.configuration as { pages?: readonly { blocks?: readonly { component?: string; content?: Record<string, unknown> }[] }[] };
  const blocks = source.pages?.[0]?.blocks ?? [];
  const hero = blocks.find((block) => block.component === 'hero')?.content;
  const notice = blocks.find((block) => block.component === 'notice')?.content;
  return {
    title: typeof hero?.title === 'string' ? hero.title : (record?.name ?? '主打团福利商城'),
    announcement: typeof notice?.announcement === 'string' ? notice.announcement : '欢迎进入企业福利商城',
  };
}

function ExperienceLoading({ failed, onClose }: Readonly<{ failed: boolean; onClose: () => void }>) {
  return (
    <div className="commerceoverlay">
      <button className="commercedialogbackdrop" type="button" onClick={onClose} aria-label="关闭装修窗口" />
      <section className="commerceflowdialog" role="dialog" aria-modal="true">
        <header>
          <div>
            <p>COMMERCE APPLICATION</p>
            <h2>商城装修</h2>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="commerceflowbody">
          <p role={failed ? 'alert' : 'status'}>{failed ? '装修详情读取失败，请关闭后重试。' : '正在读取当前草稿与历史版本…'}</p>
        </div>
      </section>
    </div>
  );
}

function actionTitle(kind: ExperienceAction['kind']): string {
  return { create: '创建商城', copy: '复制商城', manage: '管理商城', design: '商城装修' }[kind];
}

function actionSubmit(kind: ExperienceAction['kind']): string {
  return { create: '创建商城', copy: '确认复制', manage: '保存设置', design: '保存、校验并发布' }[kind];
}
