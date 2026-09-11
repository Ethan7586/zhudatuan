import type { SupplyPartnerSummary } from './SupplyChainModel';
import './business-perspective.css';

export function BusinessPerspectiveBar({ partners, selected, busy, onSelect }: Readonly<{
  partners: readonly SupplyPartnerSummary[];
  selected?: string;
  busy?: boolean;
  onSelect: (supplier?: string) => void;
}>) {
  return (
    <section className="businessperspective" aria-label="经营视角">
      <header><div><span>经营视角</span><strong>{selected === undefined ? '全部经营' : partners.find(({ id }) => id === selected)?.name ?? '供应商经营'}</strong></div>
        <small>{busy ? '正在同步经营口径…' : '同一套真实数据，按经营主体切换'}</small></header>
      <div role="tablist" aria-label="选择经营主体">
        <button type="button" role="tab" aria-selected={selected === undefined} onClick={() => onSelect()}>
          <i aria-hidden="true">全</i><span><strong>全部经营</strong><small>商城统一口径</small></span>
        </button>
        {partners.map((partner) => <button key={partner.id} type="button" role="tab" aria-selected={selected === partner.id}
          onClick={() => onSelect(partner.id)}><i aria-hidden="true">{Array.from(partner.name)[0]}</i><span><strong>{partner.name}</strong>
            <small>{partner.channel} · {formatCount(partner.productCount)} 件商品</small></span></button>)}
      </div>
    </section>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}
