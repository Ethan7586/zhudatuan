import { Badge, Button, Surface } from '@shop/design';
import { useMemo, useState } from 'react';
import { formatClock, formatMoney, incidentFor, timelineFor } from './OrderExceptionModel';
import { OrderIcon } from './OrderIcon';
import type { OrderPage } from './OrderSchema';

type ExceptionFilter = 'all' | 'overdue' | 'manual';

export function OrderExceptionWorkbench({
  page,
  isPending,
  isFetching,
  error,
  onBack,
  onRefresh,
  onOpenOrder,
  onOpenSystem,
}: Readonly<{
  page: OrderPage | undefined;
  isPending: boolean;
  isFetching: boolean;
  error: string | undefined;
  onBack: () => void;
  onRefresh: () => void;
  onOpenOrder: (id: string) => void;
  onOpenSystem: (route: string) => void;
}>) {
  const incidents = useMemo(() => {
    const updatedAt = page?.preview?.source === 'local-preview' ? page.preview.updatedAt : undefined;
    return (page?.items ?? []).map((order) => incidentFor(order, updatedAt)).sort((left, right) => right.waitMinutes - left.waitMinutes);
  }, [page]);
  const [filter, setFilter] = useState<ExceptionFilter>('all');
  const filteredIncidents = useMemo(() => incidents.filter((incident) => filter === 'all' || (filter === 'overdue' ? incident.waitMinutes > incident.targetMinutes : incident.waitMinutes >= incident.targetMinutes * 2)), [filter, incidents]);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = filteredIncidents.find((incident) => incident.order.id === selectedId) ?? filteredIncidents[0];

  const updatedAt = page?.preview?.source === 'local-preview' ? page.preview.updatedAt : undefined;
  const total = page?.preview?.source === 'local-preview' ? page.preview.total : incidents.length;
  const overdue = incidents.filter((incident) => incident.waitMinutes > incident.targetMinutes).length;
  const manual = incidents.filter((incident) => incident.waitMinutes >= incident.targetMinutes * 2).length;
  const timeline = selected === undefined ? [] : timelineFor(selected);

  return (
    <section className="orderexceptionworkspace" aria-labelledby="orderexceptiontitle">
      <header className="orderexceptionheading">
        <div>
          <p className="swoverline">ORDER EXCEPTION DESK</p>
          <h1 id="orderexceptiontitle">订单协同异常</h1>
          <p>找到卡住的订单，确认责任系统，并直接去处理。</p>
        </div>
        <div className="orderexceptionheadingactions">
          <div className="orderexceptionpurpose" aria-label="异常处置步骤">
            <span data-active="true">
              <b>1</b>找到异常订单
            </span>
            <i>→</i>
            <span>
              <b>2</b>定位当前卡点
            </span>
            <i>→</i>
            <span>
              <b>3</b>去责任系统处理
            </span>
          </div>
          <Button type="button" tone="quiet" size="compact" onPress={onBack}>
            <OrderIcon name="arrowLeft" />
            返回订单列表
          </Button>
        </div>
      </header>

      <section className="orderexceptionstats" aria-label="异常订单概览">
        <ExceptionMetric label="异常订单" value={page === undefined ? '—' : String(total)} suffix="笔" icon="order" />
        <ExceptionMetric label="已超时" value={page === undefined ? '—' : String(overdue)} suffix="笔" icon="clock" tone="danger" />
        <ExceptionMetric label="待人工处理" value={page === undefined ? '—' : String(manual)} suffix="笔" icon="settings" tone="warning" />
        <ExceptionMetric label="最近状态回写" value={formatClock(updatedAt)} icon="refresh" tone="success" />
      </section>

      {page === undefined ? (
        <Surface className="orderexceptionstate" depth="raised" padding="spacious" radius="extraLarge">
          <OrderIcon name={error === undefined ? 'refresh' : 'clock'} />
          <strong>{isPending ? '正在读取异常订单…' : '异常订单读取失败'}</strong>
          <p>{error ?? '请稍候，正在同步订单与协同系统状态。'}</p>
          {error === undefined ? null : (
            <Button tone="primary" onPress={onRefresh}>
              重试
            </Button>
          )}
        </Surface>
      ) : incidents.length === 0 ? (
        <Surface className="orderexceptionstate" depth="raised" padding="spacious" radius="extraLarge">
          <OrderIcon name="check" />
          <strong>当前没有协同异常</strong>
          <p>订单与相关系统状态已经对齐。</p>
          <Button tone="quiet" onPress={onBack}>
            返回订单列表
          </Button>
        </Surface>
      ) : (
        <div className="orderexceptiondesk" aria-busy={isFetching || undefined}>
          <Surface className="orderexceptionlistpanel" depth="raised" padding="none" radius="extraLarge">
            <header className="orderexceptionpanelhead">
              <div>
                <h2>异常订单</h2>
                <p>按等待时长排序</p>
              </div>
              <Badge tone="info">{incidents.length}</Badge>
            </header>
            <nav className="orderexceptionfilters" aria-label="异常类型">
              <FilterButton active={filter === 'all'} onPress={() => setFilter('all')}>
                全部
              </FilterButton>
              <FilterButton active={filter === 'overdue'} onPress={() => setFilter('overdue')}>
                超时
              </FilterButton>
              <FilterButton active={filter === 'manual'} onPress={() => setFilter('manual')}>
                人工处理
              </FilterButton>
            </nav>
            <ul className="orderexceptionlist" aria-label="异常订单列表">
              {filteredIncidents.map((incident) => (
                <li key={incident.order.id}>
                  <button
                    type="button"
                    className="orderexceptioncard"
                    data-selected={incident.order.id === selected?.order.id || undefined}
                    aria-pressed={incident.order.id === selected?.order.id}
                    onClick={() => setSelectedId(incident.order.id)}
                  >
                    <span className="orderexceptioncardtop">
                      <strong>{incident.order.order_number}</strong>
                      <i data-severity={incident.waitMinutes > incident.targetMinutes ? 'danger' : 'warning'} />
                    </span>
                    <b>{incident.title}</b>
                    <span className="orderexceptioncardmeta">
                      <small>{incident.ownerSystem}</small>
                      <time>{incident.waitMinutes} 分钟</time>
                    </span>
                  </button>
                </li>
              ))}
              {filteredIncidents.length === 0 ? (
                <li>
                  <p className="orderexceptionfilterempty">当前筛选下没有异常订单。</p>
                </li>
              ) : null}
            </ul>
          </Surface>

          {selected === undefined ? null : (
            <Surface className="orderexceptiontimelinepanel" depth="raised" padding="none" radius="extraLarge">
              <header className="orderexceptionpanelhead orderexceptionselectedhead">
                <div>
                  <span>当前选中订单</span>
                  <h2>{selected.order.order_number}</h2>
                  <p>
                    {selected.order.preview?.source === 'local-preview' ? selected.order.preview.mallName : (selected.order.mall_id ?? '商城未提供')} · {formatMoney(selected.order.total_minor, selected.order.currency)} ·{' '}
                    {selected.order.preview?.source === 'local-preview' ? `用户：${selected.order.preview.memberName}` : (selected.order.member_id ?? '会员未提供')}
                  </p>
                </div>
                <div className="orderexceptionlegend">
                  <span>
                    <i data-state="done" />
                    已完成
                  </span>
                  <span>
                    <i data-state="current" />
                    当前卡点
                  </span>
                </div>
              </header>
              <div className="orderexceptiontimelinebody">
                <div className="orderexceptiontimelinetitle">
                  <strong>订单纵向进度</strong>
                  <span>从下单到异常逐步核对</span>
                </div>
                <ol className="orderexceptiontimeline" aria-label={`订单 ${selected.order.order_number} 纵向进度`}>
                  {timeline.map((step) => (
                    <li key={step.key} data-state={step.state}>
                      <span className="orderexceptiontimelinenode">
                        <OrderIcon name={step.state === 'done' ? 'check' : step.state === 'current' ? 'clock' : 'more'} />
                      </span>
                      <div className="orderexceptiontimelinecontent">
                        <div>
                          <strong>{step.label}</strong>
                          <p>{step.description}</p>
                          {step.state === 'current' ? <small>已停留 {selected.waitMinutes} 分钟</small> : null}
                        </div>
                        <time>{step.state === 'current' ? '待处理' : formatClock(step.at)}</time>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </Surface>
          )}

          {selected === undefined ? null : (
            <Surface className="orderexceptionactionpanel" depth="raised" padding="none" radius="extraLarge" role="region" aria-label="当前卡点与处理动作">
              <header>
                <div>
                  <h2>当前卡点</h2>
                  <Badge tone="danger">异常</Badge>
                </div>
                <strong>{selected.reason}</strong>
                <p>
                  已等待 {selected.waitMinutes} 分钟 · {selected.waitMinutes > selected.targetMinutes ? `超过 ${selected.targetMinutes} 分钟处置目标` : `${selected.targetMinutes} 分钟处置目标内`}
                </p>
              </header>
              <div className="orderexceptionactionbody">
                <h3>责任与影响</h3>
                <dl>
                  <div>
                    <dt>责任系统</dt>
                    <dd data-system="true">{selected.ownerSystem}</dd>
                  </div>
                  <div>
                    <dt>责任角色</dt>
                    <dd>{selected.ownerRole}</dd>
                  </div>
                  <div>
                    <dt>影响金额</dt>
                    <dd>{formatMoney(selected.order.total_minor, selected.order.currency)}</dd>
                  </div>
                  <div>
                    <dt>最后事件</dt>
                    <dd>{selected.lastEvent}</dd>
                  </div>
                </dl>
                <p className="orderexceptionevidence">
                  <strong>判断依据：</strong>
                  {selected.order.preview?.source === 'local-preview' ? (selected.order.preview.operation?.label ?? selected.order.preview.summary) : '当前订单读模型未提供跨系统异常证据。'}
                </p>
                <hr />
                <h3>建议动作</h3>
                <Button className="orderexceptionprimary" tone="primary" onPress={() => onOpenSystem(selected.actionRoute)}>
                  {selected.actionLabel}
                  <OrderIcon name="arrowRight" />
                </Button>
                <Button className="orderexceptionsecondary" tone="quiet" onPress={() => onOpenOrder(selected.order.id)}>
                  查看完整订单详情
                </Button>
                <p className="orderexceptionautoclose">
                  <OrderIcon name="check" />
                  处理完成后，由状态回写自动关闭此异常，无需在两个系统重复确认。
                </p>
              </div>
            </Surface>
          )}
        </div>
      )}

      <footer className="orderexceptionnote">
        <span>
          <strong>功能口径：</strong>系统关系不再单独展示；只在具体订单卡点中标明责任归属。
        </span>
        <span>主界面只服务异常处置</span>
      </footer>
    </section>
  );
}

function ExceptionMetric({ label, value, suffix, icon, tone = 'info' }: Readonly<{ label: string; value: string; suffix?: string; icon: Parameters<typeof OrderIcon>[0]['name']; tone?: 'info' | 'danger' | 'warning' | 'success' }>) {
  return (
    <article className="orderexceptionmetric" data-tone={tone}>
      <div>
        <span>{label}</span>
        <strong>
          {value}
          {suffix === undefined ? null : <small>{suffix}</small>}
        </strong>
      </div>
      <i>
        <OrderIcon name={icon} />
      </i>
    </article>
  );
}

function FilterButton({ active, onPress, children }: Readonly<{ active: boolean; onPress: () => void; children: string }>) {
  return (
    <button type="button" aria-pressed={active} data-active={active || undefined} onClick={onPress}>
      {children}
    </button>
  );
}
