import './control.css';
import { useNavigate } from 'react-router';

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
  const navigate = useNavigate();

  return (
    <section className="merchantcapabilityscreen" aria-label="商家管理系统能力">
      <article className="merchantcapabilitywindow">
        <header className="merchantcapabilitybar">
          <div className="merchantcapabilityidentity">
            <span><img src="/brand/zhudatuan-mark-blue.svg" alt="" aria-hidden="true" /></span>
            <div><small>PLATFORM CONTROL PLANE</small><strong>系统能力 · 商家管理</strong></div>
          </div>
          <div className="merchantcapabilityactions">
            <span>按需唤起</span>
            <button type="button" aria-label="关闭商家管理" onClick={() => navigate('../applications', { replace: true })}>×</button>
          </div>
        </header>

        <div className="merchantcapabilitybody">
          <div className="merchantpage">
      <header className="merchanthero">
        <div className="merchantherocopy">
          <span className="merchantkicker">ZHUDATUAN MERCHANT OPERATIONS</span>
          <h1>商家管理</h1>
          <p>一套共享业务发动机，开通独立品牌、域名、渠道与商城体系。</p>
          <div className="merchantprinciples" aria-label="商家系统原则">
            <span>共享业务逻辑</span><span>经营数据独立</span><span>外部渠道独立</span>
          </div>
        </div>
        <div className="merchantheroaside">
          <img src="/brand/zhudatuan-mark-blue.svg" alt="" aria-hidden="true" />
          <span>界面设计预览</span>
          <button type="button" disabled title="功能将在后续批次接入">开通商家</button>
        </div>
      </header>

      <p className="merchantpreviewnotice" role="status">
        当前仅展示平台级系统能力外观，不读取商家数据，也不会产生任何创建或绑定操作。
      </p>

      <div className="merchantsummary" aria-label="商家状态概览">
        {summaries.map((item) => <article key={item.label} data-tone={item.tone}>
          <span>{item.label}</span><strong aria-label="尚未接入">—</strong><small>{item.detail}</small>
        </article>)}
      </div>

      <section className="merchantpanel merchantdelivery" aria-labelledby="merchantdeliverytitle">
        <header>
          <div><span>STANDARD DELIVERY</span><h2 id="merchantdeliverytitle">标准开通路径</h2></div>
          <small>一个入口完成整套商家系统交付</small>
        </header>
        <ol>
          {deliveryStages.map((stage) => <li key={stage.number}>
            <span>{stage.number}</span>
            <div><strong>{stage.title}</strong><small>{stage.detail}</small></div>
          </li>)}
        </ol>
      </section>

      <div className="merchantworkspace">
        <section className="merchantpanel merchantdirectory" aria-labelledby="merchantdirectorytitle">
          <header>
            <div><span>MERCHANT DIRECTORY</span><h2 id="merchantdirectorytitle">商家目录</h2></div>
            <label>搜索商家<input aria-label="搜索商家" placeholder="名称、域名或负责人" disabled /></label>
          </header>
          <div className="merchanttabs" aria-label="商家目录分类">
            <span data-active="true">全部商家</span><span>正常经营</span><span>开通中</span><span>需要处理</span>
          </div>
          <div className="merchantempty">
            <img src="/brand/zhudatuan-mark-blue.svg" alt="" aria-hidden="true" />
            <strong>商家目录即将在这里出现</strong>
            <p>后续接入真实平台实例后，可从这里查看每个商家的品牌、域名、默认商城和渠道状态。</p>
            <button type="button" disabled>开通第一个商家</button>
          </div>
        </section>

        <aside className="merchantpanel merchantengine" aria-labelledby="merchantenginetitle">
          <header><span>SHARED ENGINE</span><h2 id="merchantenginetitle">共享业务发动机</h2></header>
          <p>所有商家使用同一套标准能力，升级一次即可同步获得新版本。</p>
          <div className="merchantcapabilities">
            {sharedCapabilities.map((capability) => <span key={capability}>{capability}</span>)}
          </div>
          <div className="merchanthierarchy">
            <strong>L0 ～ L11</strong>
            <span>每个商家独立生成和管理自己的商城层级</span>
          </div>
        </aside>
      </div>
          </div>
        </div>

        <footer className="merchantcapabilityfooter">
          <span><i aria-hidden="true" />SYSTEM CAPABILITY</span>
          <p>由 Agent 或平台治理任务申请调用，完成后退出并重新隐藏。</p>
        </footer>
      </article>
    </section>
  );
}
