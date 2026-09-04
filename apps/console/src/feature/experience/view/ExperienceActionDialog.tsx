import { ReceiptPanel } from '@shop/design';
import type { ExperienceStatus } from '../model/Experience';
import type { ApplicationViewModel } from '../viewmodel/ApplicationViewModel';
import type { VersionViewModel } from '../viewmodel/VersionViewModel';

type ApplicationActionModel = ApplicationViewModel['action'];

export function ExperienceActionDialog({ application, version }: Readonly<{ application: ApplicationActionModel; version: VersionViewModel }>) {
  const action = application.value;
  if (action === null) return null;
  if (action.kind === 'design') return <VersionDialog model={version} onClose={application.actions.close} />;
  return <ApplicationDialog model={application} />;
}

function ApplicationDialog({ model }: Readonly<{ model: ApplicationActionModel }>) {
  const action = model.value;
  if (action === null || action.kind === 'design') return null;
  return (
    <div className="commerceoverlay">
      <button className="commercedialogbackdrop" type="button" onClick={model.actions.close} aria-label="关闭操作窗口" />
      <form
        className="commerceflowdialog"
        aria-label={actionTitle(action.kind)}
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <header>
          <div>
            <p>商城应用</p>
            <h2>{actionTitle(action.kind)}</h2>
          </div>
          <button type="button" onClick={model.actions.close} aria-label="关闭操作窗口">
            ×
          </button>
        </header>
        <div className="commerceflowbody commerceactionform">
          {model.receipt ? (
            <ReceiptPanel receipt={model.receipt} />
          ) : (
            <>
              <label>
                商城名称
                <input value={model.name} onChange={(event) => model.actions.name(event.target.value)} required maxLength={120} />
              </label>
              {action.kind === 'manage' ? null : (
                <label>
                  应用代码
                  <input value={model.code} onChange={(event) => model.actions.code(event.target.value.toUpperCase())} required pattern="[A-Z][A-Z0-9_]{2,31}" />
                </label>
              )}
              {action.kind === 'manage' ? null : (
                <label>
                  公开路径
                  <input value={model.slug} onChange={(event) => model.actions.slug(event.target.value.toLowerCase())} required pattern="[a-z0-9][a-z0-9-]{2,47}" />
                </label>
              )}
              {action.kind === 'manage' ? (
                <label>
                  经营状态
                  <select value={model.status} onChange={(event) => model.actions.status(event.target.value as ExperienceStatus)}>
                    <option value="draft">草稿</option>
                    <option value="active">经营中</option>
                    <option value="disabled">已停用</option>
                  </select>
                </label>
              ) : null}
              <label className="commerceconfirm">
                <input type="checkbox" checked={model.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} />
                <span>我已核对商城范围、公开入口及本次变更影响</span>
              </label>
              {model.assurance < model.required ? (
                <button type="button" onClick={model.actions.stepup}>
                  完成二次验证
                </button>
              ) : null}
              {model.validation ? (
                <p role="status" className="commerceflownotice">
                  {model.validation}
                </p>
              ) : null}
              {model.error ? (
                <p role="alert" className="commerceactionerror">
                  {model.error}
                </p>
              ) : null}
            </>
          )}
        </div>
        <footer className="commerceactionfooter">
          {model.receipt ? (
            <button type="button" onClick={model.actions.close}>
              关闭回执
            </button>
          ) : (
            <button type="submit" disabled={model.busy || model.validation !== undefined}>
              {model.busy ? '正在提交…' : actionSubmit(action.kind)}
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}

function VersionDialog({ model, onClose }: Readonly<{ model: VersionViewModel; onClose: () => void }>) {
  return (
    <div className="commerceoverlay">
      <button className="commercedialogbackdrop" type="button" onClick={onClose} aria-label="关闭装修窗口" />
      <form
        className="commerceflowdialog"
        aria-label="商城装修"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <header>
          <div>
            <p>商城应用</p>
            <h2>商城装修</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭装修窗口">
            ×
          </button>
        </header>
        <div className="commerceflowbody commerceactionform">
          {model.detailPending ? (
            <p role="status">正在读取当前草稿与历史版本…</p>
          ) : model.detailFailed ? (
            <p role="alert">装修详情读取失败，请关闭后重试。</p>
          ) : model.receipt ? (
            <ReceiptPanel receipt={model.receipt} />
          ) : (
            <>
              <label>
                首页主标题
                <input value={model.title} onChange={(event) => model.actions.title(event.target.value)} required maxLength={80} />
              </label>
              <label>
                公告文案
                <textarea value={model.announcement} onChange={(event) => model.actions.announcement(event.target.value)} required maxLength={240} />
              </label>
              <section className="commercepreview" aria-label="商城装修预览">
                <strong>{model.title}</strong>
                <p>{model.announcement}</p>
              </section>
              <p className="commerceflownotice">提交将严格执行保存草稿 → 服务端校验 → Step-up 发布 → 权威重读；任一步失败都不会覆盖当前已发布版本。</p>
              <label>
                一次性复核凭证
                <input value={model.proof} onChange={(event) => model.actions.proof(event.target.value.trim())} autoComplete="off" spellCheck={false} required />
              </label>
              <label className="commerceconfirm">
                <input type="checkbox" checked={model.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} />
                <span>我已核对预览、发布范围及当前线上版本影响</span>
              </label>
              {model.assurance < 3 ? (
                <button type="button" onClick={model.actions.stepup}>
                  完成 Step-up 复核
                </button>
              ) : null}
              {model.validation ? (
                <p role="status" className="commerceflownotice">
                  {model.validation}
                </p>
              ) : null}
              {model.error ? (
                <p role="alert" className="commerceactionerror">
                  {model.error}
                </p>
              ) : null}
            </>
          )}
        </div>
        <footer className="commerceactionfooter">
          {model.receipt ? (
            <button type="button" onClick={onClose}>
              关闭回执
            </button>
          ) : (
            <>
              {(model.detail?.history.length ?? 0) > 1 ? (
                <button type="button" onClick={model.actions.restore} disabled={model.busy || model.validation !== undefined}>
                  恢复上一版本并发布
                </button>
              ) : null}
              <button type="submit" disabled={model.busy || model.detailPending || model.detailFailed || model.validation !== undefined}>
                {model.busy ? '正在提交…' : '保存、校验并发布'}
              </button>
            </>
          )}
        </footer>
      </form>
    </div>
  );
}

function actionTitle(kind: 'create' | 'copy' | 'manage'): string {
  return { create: '创建商城', copy: '复制商城', manage: '管理商城' }[kind];
}
function actionSubmit(kind: 'create' | 'copy' | 'manage'): string {
  return { create: '创建商城', copy: '确认复制', manage: '保存设置' }[kind];
}
