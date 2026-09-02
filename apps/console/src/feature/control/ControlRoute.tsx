import './control.css';

const deliveryStages = Object.freeze([
  { number: '01', title: '商家身份', detail: '名称、Owner 与独立经营边界' },
  { number: '02', title: '品牌外观', detail: 'Logo、主色与后台名称' },
  { number: '03', title: '默认商城', detail: '自动建立 L0 标准商城' },
  { number: '04', title: '域名体系', detail: '商城、后台与账户入口' },
  { number: '05', title: '微信生态', detail: '小程序、公众号与支付' },
]);

const sharedCapabilities = Object.freeze([
  '商城装修', '商品库存', '订单履约', '支付退款',
  '财务对账', '会员权益', '分销返佣', '渠道接入',
]);

const summaries = Object.freeze([
  { label: '商家总数', tone: 'brand', detail: '接入数据后显示' },
  { label: '正常经营', tone: 'success', detail: '共享发动机运行状态' },
  { label: '开通进行中', tone: 'warning', detail: '逐步完成交付节点' },
  { label: '待完成接入', tone: 'neutral', detail: '域名与微信渠道' },
]);

export function Component() {
  return (
    <section className="controlpage" aria-label="智慧翼中控台">
      <ResourceState condition={condition} {...(error === undefined ? {} : { error })} retry={() => { void query.refetch(); }}>
        {query.data === undefined ? <span /> : <ControlContent data={query.data} refreshing={query.isFetching} onRefresh={() => { void query.refetch(); }} />}
      </ResourceState>
    </section>
  );
}
