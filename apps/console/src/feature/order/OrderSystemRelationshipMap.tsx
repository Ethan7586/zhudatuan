import { Badge, Surface, type BadgeTone } from '@shop/design';

type RelationshipKind = 'input' | 'coordination' | 'consumer';

interface RelatedSystem {
  readonly name: string;
  readonly relationship: string;
  readonly kind: RelationshipKind;
}

const INPUT_SYSTEMS: readonly RelatedSystem[] = Object.freeze([
  { name: '商品治理台', relationship: '商品、SKU 与库存', kind: 'input' },
  { name: '渠道接入系统', relationship: '商城来源、供应商与合作伙伴', kind: 'input' },
  { name: '卡券治理台', relationship: '卡券抵扣、预占与释放', kind: 'input' },
]);

const RESULT_SYSTEMS: readonly RelatedSystem[] = Object.freeze([
  { name: '财务与对账台', relationship: '支付、退款、账务与对账', kind: 'coordination' },
  { name: '履约服务', relationship: '拆单、发货、签收与退货', kind: 'coordination' },
  { name: '客服系统', relationship: '订单工单与售后跟进', kind: 'coordination' },
  { name: '分销返佣系统', relationship: '订单归因、佣金结算与冲正', kind: 'consumer' },
  { name: '数据报表', relationship: '订单投影、经营统计与导出', kind: 'consumer' },
]);

const RELATIONSHIP_LABEL: Readonly<Record<RelationshipKind, string>> = Object.freeze({
  input: '前置输入',
  coordination: '双向协同',
  consumer: '结果消费',
});

const RELATIONSHIP_TONE: Readonly<Record<RelationshipKind, BadgeTone>> = Object.freeze({
  input: 'info',
  coordination: 'warning',
  consumer: 'neutral',
});

export function OrderSystemRelationshipMap() {
  return (
    <section className="ordervi12section ordersystemmap" aria-labelledby="ordersystemmaptitle">
      <header className="ordervi12sectionhead ordersystemmapheading">
        <p className="swoverline">系统协同</p>
        <h2 id="ordersystemmaptitle">订单系统协同关系</h2>
        <p>记录当前代码中与订单形成直接业务链路的系统及交换内容。</p>
      </header>

      <Surface className="ordersystemmapsurface" depth="raised" padding="none" radius="extraLarge">
        <div className="ordersystemflow">
          <RelationshipStage id="ordersysteminputtitle" title="交易前置" systems={INPUT_SYSTEMS} />

          <FlowConnector label="形成订单" symbol="→" />

          <article className="ordersystemcore" aria-label="订单管理系统，核心记录">
            <Badge tone="success">核心记录</Badge>
            <strong>订单管理系统</strong>
            <p>统一记录订单、支付、履约和售后状态</p>
          </article>

          <FlowConnector label="执行与回写" symbol="⇄" />

          <RelationshipStage id="ordersystemresulttitle" title="执行与结果" systems={RESULT_SYSTEMS} result />
        </div>

        <footer className="ordersystemmapfooter">
          <span>关系口径 · 当前代码已实现链路</span>
          <time dateTime="2026-09-01">记录于 2026-09-01</time>
        </footer>
      </Surface>
    </section>
  );
}

function RelationshipStage({ id, title, systems, result = false }: Readonly<{ id: string; title: string; systems: readonly RelatedSystem[]; result?: boolean }>) {
  return (
    <section className="ordersystemstage" data-stage={result ? 'result' : 'input'} aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      <div className="ordersystemcards">
        {systems.map((system) => (
          <RelationshipNode key={system.name} system={system} />
        ))}
      </div>
    </section>
  );
}

function RelationshipNode({ system }: Readonly<{ system: RelatedSystem }>) {
  return (
    <article className="ordersystemnode" data-kind={system.kind}>
      <div>
        <strong>{system.name}</strong>
        <Badge tone={RELATIONSHIP_TONE[system.kind]}>{RELATIONSHIP_LABEL[system.kind]}</Badge>
      </div>
      <p>{system.relationship}</p>
    </article>
  );
}

function FlowConnector({ label, symbol }: Readonly<{ label: string; symbol: string }>) {
  return (
    <div className="ordersystemconnector" aria-hidden="true">
      <span>{symbol}</span>
      <small>{label}</small>
    </div>
  );
}
