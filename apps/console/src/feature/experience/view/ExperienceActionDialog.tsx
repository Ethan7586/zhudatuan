import { ActionReceipt } from '../../../shared/action/ActionReceipt';
import type { ApplicationViewModel } from '../viewmodel/ApplicationViewModel';
import type { VersionViewModel } from '../viewmodel/VersionViewModel';
import type { MallCreationViewModel } from '../viewmodel/MallCreationViewModel';
import { CreateJourney } from './CreateJourney';
import { DesignerPage } from './DesignerPage';

type ApplicationActionModel = ApplicationViewModel['action'];

export function ExperienceActionDialog({ application, creation, version }: Readonly<{ application: ApplicationActionModel; creation: MallCreationViewModel; version: VersionViewModel }>) {
  const action = application.value;
  if (action === null) return null;
  if (action.kind === 'create' || action.kind === 'manage') return <CreateJourney model={creation} onClose={application.actions.close} />;
  if (action.kind === 'design') return <DesignerPage model={version} onClose={application.actions.close} />;
  return <ApplicationDialog model={application} />;
}

function ApplicationDialog({ model }: Readonly<{ model: ApplicationActionModel }>) {
  const action = model.value;
  if (action === null || action.kind !== 'copy') return null;
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
            <ActionReceipt
              state={{ kind: 'success', receipt: model.receipt, objectLabel: '商城应用', impact: '仅复制装修草稿与安全资源引用，不复制域名、密钥、发布状态或历史编号。' }}
              dismiss={{ label: '关闭回执', onPress: model.actions.close }}
            />
          ) : (
            <>
              <label>
                目标商城
                <select value={model.targetMallId} onChange={(event) => model.actions.targetMall(event.target.value)} required>
                  <option value="">请选择接收装修草稿的商城</option>
                  {model.copyTargets.map((target) => (
                    <option key={target.mallId} value={target.mallId}>
                      {target.name}
                    </option>
                  ))}
                </select>
                <small>只复制当前装修草稿和安全资源引用；不会复制域名、密钥、发布状态、运行记录或历史编号。</small>
              </label>
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
        {model.receipt ? null : (
          <footer className="commerceactionfooter">
            <button type="submit" disabled={model.busy || model.validation !== undefined}>
              {model.busy ? '正在提交…' : actionSubmit(action.kind)}
            </button>
          </footer>
        )}
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
