import { ActionReceipt } from '../../../shared/action/ActionReceipt';
import { useModalFocus } from '../../../shared/view/useModalFocus';
import { useState } from 'react';
import type { VersionViewModel } from '../viewmodel/VersionViewModel';
import { Canvas } from './Canvas';
import { ComponentPanel } from './ComponentPanel';
import { ConflictPanel } from './ConflictPanel';
import { PropertyPanel } from './PropertyPanel';
import { PreviewPanel } from './PreviewPanel';
import { ValidationPanel } from './ValidationPanel';
import './Designer.css';
import './DesignerCanvas.css';
import './DesignerConflict.css';
import './DesignerFooter.css';
import './DesignerPanels.css';
import './DesignerPreview.css';

export function DesignerPage({ model, onClose }: Readonly<{ model: VersionViewModel; onClose: () => void }>) {
  const [panel, setPanel] = useState<'pages' | 'components' | 'canvas' | 'properties'>('canvas');
  const closeBlocked = model.busy || model.dirty;
  const { dialogRef, closeRef } = useModalFocus<HTMLElement>(onClose, closeBlocked);
  const document = model.preview?.configuration ?? model.document;
  return (
    <div className="commerceoverlay designerbackdrop">
      <button className="commercedialogbackdrop" type="button" onClick={onClose} disabled={closeBlocked} aria-label="关闭装修窗口" />
      <section ref={dialogRef} className="designer" role="dialog" aria-modal="true" aria-label="商城装修">
        <header className="designerhead">
          <div>
            <p>主打团 · 统一装修器</p>
            <h2>{model.record?.name ?? '商城装修'}</h2>
          </div>
          <Status model={model} />
          <nav aria-label="版本操作">
            <button type="button" onClick={model.actions.save} disabled={!model.dirty || model.busy}>
              立即保存
            </button>
            <button type="button" onClick={model.actions.validate} disabled={!model.saved || model.busy}>
              校验版本
            </button>
            <button type="button" onClick={model.preview ? model.actions.closePreview : model.actions.preview} disabled={!model.saved || model.busy}>
              {model.preview ? '返回编辑' : '预览已保存版'}
            </button>
            <button className="isprimary" type="button" onClick={model.actions.publish} disabled={!model.publishable || model.busy}>
              发布已校验版
            </button>
            <button ref={closeRef} type="button" onClick={onClose} disabled={closeBlocked} aria-label={model.dirty ? '保存后关闭装修窗口' : '关闭装修窗口'}>
              ×
            </button>
          </nav>
        </header>
        {model.receipt ? (
          <div className="designerreceipt">
            <ActionReceipt
              state={{ kind: 'success', receipt: model.receipt, objectLabel: '装修版本', impact: '公开商城已原子切换到服务端校验后的不可变版本，历史版本仍可追溯。' }}
              dismiss={{ label: '继续装修', onPress: model.actions.clearReceipt }}
            />
          </div>
        ) : null}
        {model.conflict ? <ConflictPanel conflict={model.conflict} onMerge={model.actions.mergeConflict} onReload={model.actions.reloadConflict} /> : null}
        {model.detailPending ? (
          <p className="designerloading" role="status">
            正在读取页面、组件与历史版本…
          </p>
        ) : model.detailFailed ? (
          <p className="designerloading iserror" role="alert">
            装修详情读取失败，请关闭后重试。
          </p>
        ) : document ? (
          <div className="designerworkspace">
            <nav className="designerpanelnav" aria-label="装修工作区">
              {(['pages', 'components', 'canvas', 'properties'] as const).map((item) => (
                <button key={item} type="button" aria-pressed={panel === item} onClick={() => setPanel(item)}>
                  {item === 'pages' ? '页面' : item === 'components' ? '组件' : item === 'canvas' ? '画布' : '属性'}
                </button>
              ))}
            </nav>
            <div className="designerbody" data-panel={panel}>
              <PageTree model={model} locked={Boolean(model.preview) || model.locked} />
              {model.preview ? <PreviewPanel model={model} /> : <ComponentPanel model={model} />}
              <main className="designerstage">
                <StageToolbar model={model} />
                {model.preview ? <p className="designerpreviewnote">正在预览不可变的第 {model.preview.sequence} 版；返回编辑后才能继续修改。</p> : null}
                <Canvas document={document} page={model.page} block={model.preview ? null : model.block} device={model.device} onSelect={model.preview ? () => undefined : model.actions.selectBlock} />
              </main>
              <div className="designerside">
                {model.preview ? null : <PropertyPanel model={model} />}
                <ValidationPanel
                  issues={model.issues}
                  onLocate={(path) => {
                    model.actions.locate(path);
                    setPanel('properties');
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}
        <footer className="designerfooter">
          <History model={model} />
          <label>
            <input type="checkbox" checked={model.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} disabled={model.busy} />
            <span>我已核对预览、发布范围和当前线上版本影响</span>
          </label>
          {model.assurance < 3 ? (
            <button type="button" onClick={model.actions.stepup}>
              完成二次验证
            </button>
          ) : null}
          {model.dirty && !model.busy ? (
            <button type="button" onClick={onClose}>
              放弃未保存修改并关闭
            </button>
          ) : null}
        </footer>
        {model.error ? (
          <p className="designererror" role="alert">
            {model.error}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function PageTree({ model, locked }: Readonly<{ model: VersionViewModel; locked: boolean }>) {
  const source = model.preview?.configuration ?? model.document;
  const pages = source?.pages ?? [];
  return (
    <aside className="designerpages" aria-label="页面树">
      <header>
        <strong>页面</strong>
        <button type="button" onClick={model.actions.addPage} disabled={locked || pages.length >= 100 || model.busy}>
          ＋
        </button>
      </header>
      <ol>
        {pages.map((page, index) => (
          <li key={page.id} data-selected={model.page === index}>
            <button type="button" onClick={() => model.actions.selectPage(index)}>
              <i aria-hidden="true">{page.path === 'home' ? '首' : index + 1}</i>
              <span>
                <strong>{source?.navigation.find((item) => item.page === page.id)?.label ?? '未命名页面'}</strong>
                <small>/{page.path}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="designerremove" onClick={model.actions.removePage} disabled={locked || pages[model.page]?.path === 'home' || pages.length === 1 || model.busy}>
        删除当前页面
      </button>
    </aside>
  );
}

function StageToolbar({ model }: Readonly<{ model: VersionViewModel }>) {
  return (
    <header className="designerstagebar">
      <strong>{model.preview ? `第 ${model.preview.sequence} 版预览` : '编辑画布'}</strong>
      <nav aria-label="画布尺寸">
        {(['desktop', 'tablet', 'mobile'] as const).map((device) => (
          <button key={device} type="button" aria-pressed={model.device === device} onClick={() => model.actions.device(device)}>
            {device === 'desktop' ? '桌面' : device === 'tablet' ? '平板' : '手机'}
          </button>
        ))}
      </nav>
    </header>
  );
}

function Status({ model }: Readonly<{ model: VersionViewModel }>) {
  return (
    <p className={`designerstatus is-${model.saveState}`} role="status">
      <i aria-hidden="true" />
      <span>
        <strong>{model.saveState === 'saving' ? '正在自动保存' : model.saveState === 'dirty' ? '有未保存修改' : model.saveState === 'conflict' ? '保存已暂停' : model.saveState === 'error' ? '自动保存失败' : '草稿已保存'}</strong>
        <small>{model.lastSavedAt ? `最近保存 ${new Date(model.lastSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '修改后自动保存为新版本'}</small>
      </span>
    </p>
  );
}

function History({ model }: Readonly<{ model: VersionViewModel }>) {
  const options = model.detail?.history ?? [];
  return (
    <label className="designerhistory">
      <span>历史版本</span>
      <select value={model.restoreVersion} onChange={(event) => model.actions.restoreVersion(event.target.value)}>
        <option value="">选择要恢复的版本</option>
        {options
          .filter((item) => item.id !== model.detail?.head?.id)
          .map((item) => (
            <option key={item.id} value={item.id}>
              第 {item.sequence} 版 · {item.lifecycle === 'published' ? '曾发布' : '草稿'} · {new Date(item.createdAt).toLocaleDateString('zh-CN')}
            </option>
          ))}
      </select>
      <button type="button" onClick={model.actions.restore} disabled={!model.restoreVersion || model.busy}>
        恢复并发布
      </button>
    </label>
  );
}
