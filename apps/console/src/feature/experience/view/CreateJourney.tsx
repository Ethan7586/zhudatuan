import { ActionReceipt } from '../../../shared/action/ActionReceipt';
import { useModalFocus } from '../../../shared/view/useModalFocus';
import type { MallCreationViewModel } from '../viewmodel/MallCreationViewModel';
import { ContentStep } from './ContentStep';
import { PublishStep } from './PublishStep';
import { ScopeStep } from './ScopeStep';
import { ThemeStep } from './ThemeStep';
import './CreateJourney.css';
import './JourneyForm.css';
import './JourneyTheme.css';

const steps = Object.freeze([
  Object.freeze({ label: '品牌气质', detail: '三主题与品牌色' }),
  Object.freeze({ label: '商城范围', detail: '归属、入口与负责人' }),
  Object.freeze({ label: '开店资料', detail: '主体、微信、支付与履约' }),
  Object.freeze({ label: '核对开店', detail: '完整提交与初始化' }),
]);

export function CreateJourney({ model, onClose }: Readonly<{ model: MallCreationViewModel; onClose: () => void }>) {
  const updating = model.mode === 'update';
  const close = () => {
    if (!model.busy) {
      onClose();
      if (model.receipt) model.actions.reset();
    }
  };
  const { dialogRef, closeRef } = useModalFocus<HTMLFormElement>(close, model.busy);
  return (
    <div className="commerceoverlay">
      <button className="commercedialogbackdrop" type="button" onClick={close} aria-label={`关闭${updating ? '管理' : '创建'}商城窗口`} />
      <form
        ref={dialogRef}
        className="malljourney"
        role="dialog"
        aria-modal="true"
        aria-label={updating ? '管理商城' : '创建商城'}
        onSubmit={(event) => {
          event.preventDefault();
          if (model.step === model.lastStep) model.actions.submit();
          else model.actions.next();
        }}
      >
        <header className="malljourneyhead">
          <div>
            <p>主打团 · {updating ? '商城档案' : '统一建店'}</p>
            <h2>{updating ? '管理商城' : '创建商城'}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={close} disabled={model.busy} aria-label={`关闭${updating ? '管理' : '创建'}商城窗口`}>
            ×
          </button>
        </header>
        {model.receipt ? (
          <Success model={model} onClose={close} />
        ) : (
          <div className="malljourneybody">
            <aside aria-label="开店进度">
              <p>
                {updating ? '资料复核' : '开店进度'}{' '}
                <strong>
                  {model.step + 1}/{steps.length}
                </strong>
              </p>
              <ol>
                {steps.map((step, index) => (
                  <li key={step.label} data-state={index === model.step ? 'current' : index <= model.furthestStep ? 'complete' : 'upcoming'}>
                    <button type="button" disabled={index > model.furthestStep + 1} onClick={() => model.actions.step(index)} aria-current={index === model.step ? 'step' : undefined}>
                      <i>{index <= model.furthestStep && index !== model.step ? '✓' : index + 1}</i>
                      <span>
                        <strong>{step.label}</strong>
                        <small>{step.detail}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <section>
                <strong>{updating ? '并发保护' : '自动保存'}</strong>
                <span>{updating ? '保存时校验当前资料版本，发现他人改动会要求重新核对。' : '本次填写保存在当前浏览器会话；创建成功后自动清除。'}</span>
              </section>
            </aside>
            <main>
              {model.recordPending ? (
                <p role="status" className="malljourneynotice">
                  正在读取商城完整资料与当前版本…
                </p>
              ) : model.step === 0 ? (
                <ThemeStep model={model} />
              ) : model.step === 1 ? (
                <ScopeStep model={model} />
              ) : model.step === 2 ? (
                <ContentStep model={model} />
              ) : (
                <PublishStep model={model} />
              )}
              {!model.available ? (
                <p className="malljourneyerror" role="alert">
                  当前账号没有{updating ? '读取并管理此商城' : '创建商城'}的权限或能力，请切换到有权管理的组织范围。
                </p>
              ) : null}
              {model.recordError ? (
                <p className="malljourneyerror" role="alert">
                  {model.recordError}
                </p>
              ) : null}
              {model.error ? (
                <p className="malljourneyerror" role="alert">
                  {model.error}
                </p>
              ) : null}
              {model.validation ? (
                <p className="malljourneynotice" role="status">
                  {model.validation}
                </p>
              ) : null}
            </main>
          </div>
        )}
        {model.receipt ? null : (
          <footer className="malljourneyfooter">
            <button type="button" onClick={close} disabled={model.busy}>
              取消
            </button>
            <span />
            {model.step > 0 ? (
              <button type="button" onClick={model.actions.previous} disabled={model.busy}>
                上一步
              </button>
            ) : null}
            {model.assurance < model.required && model.step === model.lastStep ? (
              <button type="button" onClick={model.actions.stepup}>
                完成二次验证
              </button>
            ) : null}
            <button
              type="submit"
              className="isprimary"
              disabled={!model.available || model.busy || model.recordPending || (model.mode === 'create' && model.step > 0 && model.parentsPending) || (model.step === model.lastStep && !model.confirmed)}
            >
              {model.busy ? (updating ? '正在保存…' : '正在创建…') : model.step === model.lastStep ? (updating ? '保存商城资料' : '确认创建商城') : '继续'}
            </button>
          </footer>
        )}
      </form>
    </div>
  );
}

function Success({ model, onClose }: Readonly<{ model: MallCreationViewModel; onClose: () => void }>) {
  const receipt = model.receipt!;
  return (
    <div className="malljourneysuccess">
      <ActionReceipt
        state={{
          kind: 'success',
          objectLabel: '商城',
          impact: receipt.action === 'created' ? '已创建独立商品池、应用与主题初始化任务。' : '应用名称、主题、域名和经营状态将由可靠事件同步。',
          details: [
            { label: '商城名称', value: receipt.mall.name },
            { label: '品牌', value: receipt.mall.brandName },
            { label: '公开入口', value: receipt.mall.domain.mode === 'custom' ? receipt.mall.domain.customDomain : receipt.mall.publicSlug },
            { label: '下一步', value: '刷新商城应用清单，初始化完成后进入装修并发布。' },
          ],
          receipt: {
            requestId: receipt.requestId,
            reference: receipt.mall.id,
            occurredAt: receipt.mall.updatedAt,
            message: receipt.action === 'created' ? '商城完整资料已保存；独立商品池、应用和主题草稿正在由后台可靠初始化。' : '商城资料已按当前版本保存；应用名称、主题、域名和经营状态将由可靠事件同步。',
          },
        }}
        dismiss={{ label: '完成', tone: 'primary', onPress: onClose }}
      />
    </div>
  );
}
