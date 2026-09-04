# 微信支付生产接入与MVP验收

> 版本：2026-08-21  
> 适用范围：智慧翼福利商城模块化单体、员工商城H5、微信小程序、`ApiMain`、`JobsMain`、微信支付API v3  
> 上位基线：[福利商城根治实施方案](./福利商城根治实施方案.md)与[福利商城功能清单](./福利商城功能清单.xlsx)  
> 裁决：本文件细化微信身份、微信支付、MVP浏览器验收和生产发布，不改变上位基线的PostgreSQL唯一事实源、模块化单体、DDD依赖方向、硬切换和禁止生产模拟等裁决。

## 1. 先给结论

本次代码已经把原先“测试环境模拟支付”替换为可装配真实微信支付API v3的生产协议链路，并完成以下闭环：

1. 小程序与公众号JSAPI使用两个独立AppID；身份OpenID和支付尝试按`scene + application_hash`严格隔离，禁止跨AppID误用OpenID。
2. 商户号、商户API证书私钥、API v3密钥、微信支付公钥和通知地址由密钥引用装配，启动时严格校验，生产代码不读取散落环境明文。
3. 预支付请求使用商户私钥签名；响应及回调按`Wechatpay-Serial`选择微信支付公钥验签；回调资源使用API v3密钥按`AEAD_AES_256_GCM`解密。
4. 支付请求先提交本地`attempt=started`，再调用微信，绝不持有数据库事务等待外部网络。
5. 客户端只负责拉起支付；“支付成功”只认服务端验签回调或主动查单得到的微信终态。
6. 通知按原始请求体验签，校验商户、AppID、订单号、金额、币种、付款OpenID哈希，写入不可重复消费的provider inbox，再异步结算。
7. 查单、关单、退款、退款查询、迟到支付自动退款、死信和人工恢复均进入独立Jobs链路。
8. 微信支付公钥支持新旧密钥重叠轮换：一个active发起请求，历史inactive仍可按序列号验签，未知序列号拒绝。
9. H5登录改为公众号静默OAuth；小程序仍使用`wx.login`；绑定使用一次性短期凭据，不允许手工粘贴绑定令牌。
10. 提供独立浏览器MVP编排服务，覆盖首页、商品、购物车、报价、下单、发起JSAPI支付、轮询服务端终态；它是测试证据工具，不会进入生产依赖图。

### 1.1 必须如实区分的三个“完成”

| 层级 | 当前结论 | 能证明什么 | 不能证明什么 |
| --- | --- | --- | --- |
| 代码与协议 | 已实现，待本文件末尾全量门禁结果确认 | 请求签名、验签、解密、场景隔离、状态机、查关退与恢复设计真实存在 | 不能证明商户平台配置正确 |
| 浏览器MVP编排 | 测试服务和页面链路已具备；本次浏览器工具因URL策略阻止导航，未形成截图和完整浏览器录制 | 可复现页面到API的完整编排 | 不能冒充微信客户端或真实资金流 |
| 真实资金验收 | 尚未执行 | 只有真实商户配置下完成至少一笔¥0.01支付及退款才可通过 | 无真实凭据、无微信客户端、无商户账单时严禁宣称上线 |

因此，当前可以说“真实微信支付生产代码已接入”；在第18节生产验收全部打勾前，不可以说“真实微信支付已完成资金验收或已上线”。

## 2. 需求基线与范围闭合

### 2.1 Excel的21条需求行

`MVP上线功能清单`中第3至23行是21条需求行；标题和表头不计为功能。它们与模块的唯一映射如下。

| Excel行 | 层级/菜单 | 唯一负责模块 | 微信支付对该项的影响 |
| --- | --- | --- | --- |
| 3 | 平台层预留、商品池、卡号库 | `organization`、`catalog`、`voucher` | 无直接影响，支付只消费已发布商品和有效卡券 |
| 4 | 分销层 | `organization`、`channel`、`partner` | 订单、支付和结算保留分销Scope |
| 5 | 集团数据大屏 | `reporting` | 消费`payment.succeeded/refunded`投影，不直接查微信 |
| 6 | 集团应用/商城创建复制装修 | `organization`、`experience` | AppID不属于商城装修数据，由平台配置统一管理 |
| 7 | 集团商品池 | `catalog`、`pricing`、`channel` | 支付金额只能来自服务端报价快照 |
| 8 | 集团订单与售后 | `order`、`aftersale`、`payment` | 支付、退款和售后金额强关联 |
| 9 | 集团卡券中心 | `voucher` | 混合支付按tender拆分，退款按原路分摊 |
| 10 | 集团财务 | `finance` | 只消费不可变支付事实和provider对账事实 |
| 11 | 集团数据统计 | `reporting` | 支付事件驱动投影和异步导出 |
| 12 | 集团客服中心 | `support` | 只读脱敏支付状态；退款需授权和审计 |
| 13 | 集团设置 | `access`、`member`、`partner`、`notification`、`risk` | 支付权限、MFA、风控、通知统一生效 |
| 14 | 商城销售数据 | `reporting` | 以商城Scope投影支付和退款 |
| 15 | 商城装修 | `experience` | 前端支付入口来自发布体验，支付协议不由装修覆盖 |
| 16 | 商城商品池 | `catalog`、`pricing`、`channel` | 下单时重新校验价格、可售性和库存 |
| 17 | 商城订单与售后 | `order`、`aftersale`、`payment` | 同第8行，但限制在商城Scope |
| 18 | 商城卡券中心 | `voucher` | 同第9行，但限制在商城Scope |
| 19 | 商城财务 | `finance` | 同第10行，但限制在商城Scope |
| 20 | 商城数据统计 | `reporting` | 同第11行，但限制在商城Scope |
| 21 | 商城客服中心 | `support` | 同第12行，但限制在商城Scope |
| 22 | 商城设置 | `access`、`member`、`partner`、`notification`、`risk` | 同第13行，但限制在商城Scope |
| 23 | 接口表优先级1优先接入 | `channel`、`extension`及provider扩展 | 微信支付不替代供应链接入，二者共享订单事实源 |

### 2.2 Excel接口表优先级1的11项

| Excel项 | Provider扩展 | Vendor适配器 | 生产准入要求 |
| --- | --- | --- | --- |
| 京东 | `jdproduct` | `jd` | 正式采购账号、clientId、token轮换、商品/库存/订单/售后联调 |
| 京东生鲜 | `jdfresh` | `jd` | 独立provider配置与契约测试 |
| 天猫超市 | `tmallmarket` | `tmall` | 正式应用授权及回调白名单 |
| 自有供应商 | `private` | 自有协议 | 每个供应商独立Scope和幂等键 |
| 蛋糕 | `cake` | `cakeuncle` | API凭据、门店/配送时段和退款联调 |
| 鲜花 | `flower` | `cakeuncle` | 城市、时段、配送失败补偿联调 |
| 图书 | `book` | `wenxuan` | 工作簿旧凭据不得使用，只从密钥库装配 |
| 虚拟卡券/直充 | `directcharge` | `wanlian` | 卡密不落日志，发放回调幂等 |
| 虚拟食品提货券 | `foodvoucher` | `cakeuncle` | 券码加密、核销与退款约束 |
| 电影 | `movie` | `wanlian` | 场次锁定和出票补偿 |
| 在线点餐 | `meal` | `cakeuncle` | 门店、菜单、时段和订单取消联调 |

这些扩展已经按provider/vendor两层拆分，符合即插即用方向；某个渠道只有在正式凭据、沙箱/生产契约、账单核对和运行告警都通过后，才可以把其状态标为Released。

## 3. 最终系统架构

```mermaid
flowchart LR
  subgraph Client[客户端]
    Mini[微信小程序]
    H5[公众号内员工商城H5]
    Admin[运营/财务/客服后台]
  end

  subgraph Edge[边缘与入口]
    WAF[WAF/限流/TLS]
    API[ApiMain]
  end

  subgraph Core[模块化单体]
    Identity[Identity]
    Access[Access/Capability/Risk]
    Catalog[Catalog/Pricing/Inventory]
    Checkout[Cart/Checkout/Order]
    Payment[Payment]
    Downstream[Fulfillment/Voucher/Benefit/Finance]
    Projection[Reporting/Notification/Audit/Support]
  end

  subgraph Runtime[异步运行时]
    Jobs[JobsMain]
    Queue[(runtime.job)]
    Inbox[(provider inbox)]
    Outbox[(domain outbox)]
    Recovery[(deadletter/recovery)]
  end

  subgraph Truth[唯一事实与密钥]
    PG[(PostgreSQL)]
    KMS[KMS/Secret Manager]
  end

  subgraph Wechat[微信]
    Open[微信开放接口]
    Pay[微信支付API v3]
    Bridge[JSAPI/小程序支付桥]
  end

  Mini --> WAF
  H5 --> WAF
  Admin --> WAF
  WAF --> API
  API --> Identity
  API --> Access
  API --> Catalog
  API --> Checkout
  API --> Payment
  Identity --> Open
  Identity --> PG
  Payment --> PG
  Payment --> Pay
  API --> Inbox
  Core --> Outbox
  Outbox --> Queue
  Inbox --> Queue
  Jobs --> Queue
  Jobs --> Payment
  Jobs --> Downstream
  Jobs --> Projection
  Jobs --> Recovery
  Core --> PG
  Jobs --> PG
  API --> KMS
  Jobs --> KMS
  Pay --> WAF
  Mini --> Bridge
  H5 --> Bridge
  Bridge --> Pay
```

### 3.1 部署拓扑

```mermaid
flowchart TB
  DNS[支付目录域名] --> LB[公网HTTPS负载均衡]
  LB --> API1[ApiMain实例A]
  LB --> API2[ApiMain实例B]
  API1 --> PGB[(PostgreSQL主库/连接池)]
  API2 --> PGB
  J1[JobsMain实例A] --> PGB
  J2[JobsMain实例B] --> PGB
  API1 --> Secret[密钥管理服务]
  API2 --> Secret
  J1 --> Secret
  J2 --> Secret
  API1 --> WX[微信支付]
  API2 --> WX
  J1 --> WX
  J2 --> WX
  PGB --> Replica[(只读副本/报表)]
  Logs[日志/指标/Trace] --- API1
  Logs --- API2
  Logs --- J1
  Logs --- J2
```

部署裁决：

- `ApiMain`处理同步HTTP、OAuth和微信回调；`JobsMain`处理查单、关单、退款、对账和支付后效应。
- API和Jobs可以横向扩容；任务依靠数据库租约/状态而不是进程内内存保证唯一处理。
- PostgreSQL是订单、支付和任务状态唯一事实源。浏览器缓存、微信客户端回调、队列消息都不是事实源。
- 回调路径只开放`POST /api/v1/webhooks/wechat/payment`；其他方法、超大请求、错误Content-Type、无有效签名都拒绝。
- 生产禁止加载`03_quality_ceshi/tests/browser/MvpServer.mjs`、历史payment simulation RPC或任何“支付成功开关”。

## 4. DDD、SOLID和设计模式落点

```mermaid
flowchart LR
  Interface[interface/http 或 OperationController] --> Application[application command/query]
  Application --> Domain[domain model/policy]
  Application --> Port[application port]
  Infrastructure[infrastructure adapter/persistence] --> Port
  Bootstrap[bootstrap composition root] --> Interface
  Bootstrap --> Infrastructure
  Domain -.禁止依赖.-> Infrastructure
  Domain -.禁止依赖.-> Framework[HTTP/数据库/微信SDK]
```

| 原则 | 具体实现 |
| --- | --- |
| 单一职责 | 微信协议放在`extensions/payment/wechat`；业务状态机放在`payment/domain`；装配只在`CommerceRuntime` |
| 开闭原则 | `PaymentGateway`是小端口；新增支付渠道增加adapter，不修改支付聚合根规则 |
| 里氏替换 | adapter必须通过同一查询、关闭、退款、通知语义，不得返回“看似成功”的渠道特例 |
| 接口隔离 | 身份使用`WechatIdentity`，支付使用`PaymentGateway`；不暴露万能WechatClient |
| 依赖倒置 | Application依赖port；真实微信adapter向内实现port |
| 迪米特法则 | `PaymentOperations`不知道RSA/AES/header细节；前端不知道商户私钥、API v3密钥和订单结算SQL |
| Repository | PostgreSQL持久化封装在模块infrastructure或模块应用服务，不让UI拼SQL |
| Adapter | `WechatGateway`把微信交易语义映射到领域支付语义 |
| Strategy | `AllocationPolicy`决定混合支付和退款腿分配 |
| State Machine | `PaymentLifecycle`和数据库CHECK共同限制状态迁移 |
| Outbox/Inbox | 事务内记录领域事实；provider回调先入Inbox再调度Job |
| Saga/Process Manager | 支付成功后财务、履约、通知各自成为可重试effect |
| Circuit/Retry | 只有明确可重试的读取调用按截止时间重试；创建预支付结果未知时进入查单，不盲重放 |
| Idempotency | HTTP request claim、订单provider reference、回调event id、支付capture、退款号均有唯一键 |

## 5. 配置和密钥唯一来源

### 5.1 三个配置文档

环境变量只保存密钥管理服务的引用：

```dotenv
WECHAT_APPLICATION_CONFIG_REF=secret://commerce/wechat/applications/current
WECHAT_IDENTITY_CONFIG_REF=secret://commerce/wechat/identity/current
WECHAT_PAYMENT_CONFIG_REF=secret://commerce/wechat/payment/current
```

`WECHAT_APPLICATION_CONFIG_REF`不是秘密，但仍集中管理，避免身份与支付重复AppID：

```json
{
  "applications": [
    { "scene": "miniapp", "appId": "wx0000000000000001" },
    { "scene": "jsapi", "appId": "wx0000000000000002" }
  ]
}
```

`WECHAT_IDENTITY_CONFIG_REF`仅由`ApiMain`读取：

```json
{
  "applications": [
    { "scene": "miniapp", "appSecret": "<小程序AppSecret>" },
    {
      "scene": "jsapi",
      "appSecret": "<公众号AppSecret>",
      "authorizationCallbackUrl": "https://auth.example.com/wechat/callback"
    }
  ]
}
```

`WECHAT_PAYMENT_CONFIG_REF`由`ApiMain`和`JobsMain`读取：

```json
{
  "mchId": "1900000001",
  "merchantSerialNo": "0123456789ABCDEF0123456789ABCDEF01234567",
  "merchantPrivateKeyPem": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
  "apiV3Key": "0123456789abcdef0123456789abcdef",
  "notifyUrl": "https://api.example.com/api/v1/webhooks/wechat/payment",
  "platformKeys": [
    {
      "id": "PUB_KEY_ID_0000000000000001",
      "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
      "active": true
    },
    {
      "id": "PUB_KEY_ID_0000000000000000",
      "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
      "active": false
    }
  ]
}
```

### 5.2 启动即失败规则

- 配置对象必须exact-shape；未知字段直接失败，避免拼错字段被静默忽略。
- 必须恰好存在`miniapp`和`jsapi`两个场景，且AppID不同、格式有效。
- JSAPI OAuth callback与支付notify URL必须是公网HTTPS；拒绝用户名密码、query、fragment、localhost和私网IPv4。
- 商户私钥只接受PKCS#8，微信支付公钥只接受SPKI。
- `platformKeys`数量为1至8、ID唯一、恰好一个active。
- API v3密钥必须恰好32字节；商户号、序列号、URL和密钥格式任一错误均阻止进程ready。
- 日志、审计、错误响应、Trace attribute一律不得包含AppSecret、私钥、API v3密钥、OpenID明文或解密后的回调原文。

### 5.3 微信商户平台前置配置

1. 小程序AppID、公众号AppID必须都与同一商户号建立JSAPI支付授权关系。
2. 配置JSAPI支付授权目录，精确到员工商城实际支付目录并保留末尾`/`。
3. 配置公众号网页授权域名，不包含协议和路径；回调URL必须与密钥文档完全一致。
4. 配置API v3密钥；下载商户API证书并提取匹配的PKCS#8私钥与序列号。
5. 启用微信支付公钥模式，记录当前公钥ID和公钥；轮换时先加入新key，再切active，最后在观察窗后移除旧key。
6. 回调域名具备有效公网证书、稳定DNS和WAF例外；不得要求Cookie、CSRF或人工登录。
7. 商户平台、公众号平台、小程序平台、密钥库、部署平台的变更均保留双人复核审计。

## 6. 数据模型与强不变量

```mermaid
erDiagram
  ORDERRECORD ||--|| INTENT : owns
  INTENT ||--|{ INTENTTENDER : plans
  INTENT ||--o{ ATTEMPT : tries
  INTENT ||--o| PREPAY : caches
  ATTEMPT ||--o{ OBSERVATION : observes
  INTENT ||--o| PAYMENT : settles
  PAYMENT ||--|{ CAPTURE : records
  PAYMENT ||--|{ ALLOCATION : allocates
  PAYMENT ||--o{ REFUND : refunds
  REFUND ||--|{ REFUNDTENDER : splits
  REFUND ||--o{ PROVIDERATTEMPT : calls
  PAYMENT ||--o{ EFFECT : triggers
  RECOVERYCASE ||--o{ RECOVERYREQUEST : resolves
```

| 表/事实 | 责任 | 关键不变量 |
| --- | --- | --- |
| `payment.intent` | 一张订单一次支付意图 | `provider_reference`唯一；金额为正；过期时间固定；状态受CHECK限制 |
| `payment.intenttender` | 福利、券、微信等支付腿计划 | 各腿之和等于intent金额；sequence稳定 |
| `payment.attempt` | 一次微信支付尝试 | 进行中的真实尝试必须有`scene`和`application_hash`；微信交易号唯一 |
| `payment.prepay` | 客户端预支付参数 | 每个intent最多一份；只在服务端生成 |
| `payment.observation` | 回调/查单/关单观测 | provider event唯一；保存payload hash，不把明文秘密复制到业务表 |
| `payment.payment` | 最终支付聚合 | 每个intent最多一条；退款额不超过capture额 |
| `payment.capture` | 不可变收款事实 | 每订单唯一；幂等键唯一 |
| `payment.allocation` | 收款分配 | 按目标唯一，金额为正 |
| `payment.refund` | 退款聚合 | provider reference、幂等键唯一；累计退款不超捕获金额 |
| `payment.refundtender` | 原路退款腿 | 福利/券/微信各自按原支付腿退回 |
| `payment.providerattempt` | 外部退款调用证据 | 递增sequence；unknown不得假装失败或成功 |
| `payment.effect` | 财务/履约/通知后效应 | 各effect独立重试和死信，不回滚已确认支付 |
| `runtime.providerinbox` | 回调原始证据 | provider + event id唯一；验签后才写入 |
| `runtime.job` | 异步工作 | owner/kind/payload明确；租约、退避、最大尝试受控 |
| `payment.recoverycase` | 人工恢复入口 | 资源维度唯一开放case；所有处理留request证据 |

支付状态机：

```mermaid
stateDiagram-v2
  [*] --> created
  created --> authorizing: 创建attempt并提交
  authorizing --> authorized: 预支付已取得
  authorizing --> captured: 回调/查单SUCCESS
  authorized --> captured: 回调/查单SUCCESS
  authorizing --> created: 明确失败且可重试
  authorizing --> expired: 超时且查单不存在/已关闭
  authorized --> expired: 超时且关单成功
  created --> cancelled: 订单取消
  captured --> [*]
  expired --> captured: 迟到SUCCESS，只记录真实资金事实
  captured --> refunded: 自动原路退款完成
```

强不变量：

- 金额统一使用人民币分的安全整数，禁止浮点金额进入领域和provider请求。
- AppID不在多个secret中重复；数据库只存SHA-256，不把AppID当秘密但减少散落复制。
- OpenID只在KMS密文中保存；支付attempt只保存OpenID哈希，回调按哈希比对。
- 创建attempt和提交本地状态必须先于外部请求；外部请求期间不持有数据库连接和行锁。
- provider返回超时、连接断开或5xx时，创建动作结果是`unknown`，后续查单确认；不得直接重复创建。
- 客户端`getBrandWCPayRequest:ok`只表示客户端调用被接受，不驱动订单paid。
- 任何回调的金额、币种、商户、AppID、付款人或订单号不一致都整体拒绝，不做“尽量接受”。
- 已过期/已取消订单收到真实SUCCESS时先承认资金事实，再创建自动退款，不隐瞒迟到支付。

## 7. API合同

| Operation | HTTP | 调用者 | 输入 | 成功输出/语义 |
| --- | --- | --- | --- | --- |
| `identity.wechat.session` | `POST /api/v1/identity/wechat/sessions` | 小程序/公众号回调页 | `authorize`: `scene=jsapi`；或`exchange`: `scene + code` | OAuth URL、登录session，或一次性binding token |
| `identity.wechat.bind` | `POST /api/v1/identity/wechat/bindings` | 已登录会员 | `bindingToken` | 消费一次性凭据并绑定当前principal |
| `payment.intents.create` | `POST /api/v1/payments/intents` | 小程序/H5 | `order + scene`，携带幂等键和Scope | `201 parameters`、`200 cached/captured`或`202 reconciling` |
| `payment.webhooks.wechat` | `POST /api/v1/webhooks/wechat/payment` | 微信支付 | 原始body和Wechatpay签名头 | 固定`204`且无响应body |
| `payment.refunds.request` | `POST /api/v1/payments/refunds` | 授权后台/售后流程 | `payment + amountMinor + reason` | `202`并异步执行原路退款 |
| `payment.recoveries.read` | `GET /api/v1/payments/recoveries` | 有权限操作员 | keyset query | 恢复case列表 |
| `payment.recoveries.resolve` | `POST .../{caseid}/resolutions` | MFA/权限满足的操作员 | `replay/requery/retryrefund/resolve + reason` | 记录不可变请求并异步处理 |

预支付返回仅允许：

```json
{
  "intent": "intent:...",
  "parameters": {
    "appId": "wx...",
    "timeStamp": "1786665600",
    "nonceStr": "...",
    "package": "prepay_id=...",
    "signType": "RSA",
    "paySign": "...",
    "providerRequestId": "..."
  }
}
```

私钥、API v3密钥、OpenID、商户签名串、解密资源和完整provider响应不得返回浏览器。

## 8. 模块间关键调用时序

### 8.1 小程序身份与支付场景

```mermaid
sequenceDiagram
  autonumber
  participant M as 小程序
  participant API as Identity Operation
  participant WX as jscode2session
  participant K as KMS
  participant DB as PostgreSQL
  M->>WX: wx.login取得一次性code
  M->>API: exchange(scene=miniapp, code)
  API->>WX: appid + secret + js_code
  WX-->>API: openid/unionid
  API->>K: 加密openid/unionid
  API->>DB: 按miniapp application_hash upsert身份
  API-->>M: session token或binding token
  M->>API: create payment(order, scene=miniapp)
  API->>DB: 只选miniapp application_hash对应身份
  Note over API,DB: 找不到即WECHAT_IDENTITY_REQUIRED，绝不借用公众号OpenID
```

### 8.2 公众号OAuth登录和绑定

```mermaid
sequenceDiagram
  autonumber
  participant H as 微信内H5
  participant API as Identity Operation
  participant T as AuthTransaction/PgAuthTicket
  participant OA as 微信公众号OAuth
  participant DB as PostgreSQL
  H->>API: authorize(scene=jsapi)
  API->>T: 创建state + PKCE事务
  API-->>H: open.weixin.qq.com授权URL
  H->>OA: snsapi_base静默授权
  OA-->>H: /wechat/callback?code&state
  H->>API: exchange(scene=jsapi, code, state)
  API->>T: 原子消费state，拒绝重放
  API->>OA: oauth2/access_token
  OA-->>API: openid/unionid
  API->>DB: 按jsapi application_hash查找/自动关联UnionID
  alt 已有主体
    API-->>H: 安全session + CSRF
  else 未绑定
    API-->>H: 短期单次binding token
    H->>H: 用户完成原有密码登录
    H->>API: bind(binding token)
    API->>DB: 原子消费并绑定当前主体
  end
```

### 8.3 报价、强一致下单与混合支付

```mermaid
sequenceDiagram
  autonumber
  participant C as 客户端
  participant Cart as Cart
  participant Check as Checkout
  participant Price as Pricing
  participant Inv as Inventory
  participant Voucher as Voucher/Benefit
  participant Order as Order
  participant Pay as Payment
  participant DB as PostgreSQL
  C->>Cart: 读取服务端购物车
  C->>Check: 创建报价
  Check->>Price: 当前有效价格/限购
  Check->>Inv: 当前可用库存
  Check->>Voucher: 当前券和福利余额
  Check-->>C: quote + expires_at + tender plan
  C->>Order: 以quote幂等下单
  Order->>DB: 按固定锁序锁quote/库存/券/余额
  Order->>Inv: 原子预留库存
  Order->>Pay: 创建intent和tender计划
  Order->>DB: 同一事务提交订单
  Order-->>C: order id
  Note over C,DB: 客户端金额永不作为下单事实
```

### 8.4 创建预支付：提交在外部调用之前

```mermaid
sequenceDiagram
  autonumber
  participant C as 小程序/H5
  participant O as PaymentOperations
  participant DB as PostgreSQL
  participant K as KMS
  participant G as WechatGateway
  participant WX as 微信支付API v3
  C->>O: create(order, scene, idempotency)
  O->>DB: BEGIN + Scope/权限/claim request
  O->>DB: 锁order/intent，校验金额/状态/scene/AppHash
  O->>DB: insert attempt(started) + mark authorizing
  O->>DB: COMMIT
  Note over O,DB: 此处已释放连接和行锁
  O->>K: 解密当前AppID下的OpenID
  O->>DB: 保存payer_hash
  O->>G: prepay(amount, payer, app context, expiresAt)
  G->>G: 构造JSON、RSA-SHA256签名、Authorization
  G->>WX: POST /v3/pay/transactions/jsapi
  WX-->>G: 签名响应 + prepay_id
  G->>G: 按Wechatpay-Serial验签并生成客户端paySign
  G-->>O: 最小预支付参数
  O->>DB: 保存prepay + attempt pending + enqueue query
  O-->>C: 201 parameters
```

异常分支：

- 明确的4xx协议拒绝：attempt标记failed，客户端收到稳定错误码。
- 超时/断连/可重试5xx：attempt标记unknown，立即创建`paymentquery`，返回`202 reconciling`。
- 同一幂等请求已完成：返回原响应；已有prepay：返回缓存；已有started/unknown/pending：不再创建微信订单。

### 8.5 客户端拉起支付与服务端回读

```mermaid
sequenceDiagram
  autonumber
  participant UI as 支付页
  participant Bridge as WeixinJSBridge/wx.requestPayment
  participant WX as 微信支付
  participant API as Order Query
  UI->>UI: 校验MicroMessenger和参数完整性
  UI->>Bridge: 拉起支付
  Bridge->>WX: 用户确认/密码/生物验证
  WX-->>Bridge: ok/cancel/fail
  alt cancel
    UI-->>UI: 显示已取消，订单仍可支付
  else ok
    UI->>API: 进入结果页并每2秒查询订单
    API-->>UI: unpaid/authorizing/paid
    Note over UI,API: 只有paid才展示成功；最多15次后展示处理中而非伪成功
  else fail
    UI-->>UI: 稳定失败提示，服务端后台仍查单
  end
```

### 8.6 支付回调内部时序

```mermaid
sequenceDiagram
  autonumber
  participant WX as 微信支付
  participant API as Webhook Endpoint
  participant Sig as Signature/Crypto
  participant G as WechatGateway
  participant DB as PostgreSQL/Inbox
  participant J as JobsMain
  participant S as PaymentSettlement
  WX->>API: headers + raw body
  API->>G: verifyNotification
  G->>Sig: timestamp + nonce + rawBody + serial验签
  Sig->>Sig: 选择active或保留的inactive公钥
  G->>Sig: APIv3 AES-GCM解密resource
  G->>G: 校验mchid、事件类型、交易状态、AppID
  G-->>API: 最小观测事实 + evidence摘要
  API->>DB: 锁intent/refund并校验订单号/金额/币种/payerHash/scene/AppHash
  API->>DB: accept_provider_webhook(event id, raw hash)
  alt 首次事件
    API->>DB: enqueue paymentquery/paymentrefund
  else 重复且内容相同
    API->>DB: 幂等忽略
  else 同ID不同body hash
    API-->>WX: 拒绝并告警
  end
  API-->>WX: 204，无响应body
  J->>DB: claim job + 查intent
  J->>WX: 主动查单确认终态
  J->>S: settle
  S->>DB: payment/capture/allocation/effects/outbox同事务提交
```

### 8.7 查单、关单和迟到支付

```mermaid
sequenceDiagram
  autonumber
  participant J as PaymentJobs
  participant DB as PostgreSQL
  participant WX as 微信支付
  participant R as RefundPlanner
  J->>DB: claim paymentquery并读取原scene/AppHash
  J->>WX: 按原AppID query(outTradeNo)
  alt SUCCESS且订单有效
    J->>DB: 原子settle并发出payment.succeeded
  else USERPAYING/NOTPAY
    J->>DB: 指数退避再次查单
  else 过期且尚未支付
    J->>WX: close(outTradeNo)
    J->>WX: 再次query避免关单竞态
    J->>DB: 只有不存在/已关闭才标expired并释放资源
  else 订单已取消/过期但微信SUCCESS
    J->>DB: 记录真实capture + payment.late.detected
    J->>R: 创建全额原路退款
    J->>DB: payment.autorefund.requested + recovery evidence
  end
```

### 8.8 售后与退款

```mermaid
sequenceDiagram
  autonumber
  participant A as 售后/财务
  participant P as RefundPlanner
  participant DB as PostgreSQL
  participant J as Refund Job
  participant WX as 微信支付
  participant S as RefundSettlement
  A->>P: request(payment, amount, reason, idempotency)
  P->>DB: 锁payment和历史退款
  P->>P: 按原tender顺序拆分福利/券/微信退款腿
  P->>DB: 保存refund/refundtender并enqueue
  J->>DB: claim + providerattempt(sequence)
  J->>WX: 以transaction_id申请微信退款
  alt SUCCESS
    J->>S: 原子结算各退款腿
  else PROCESSING/结果未知
    J->>WX: 按out_refund_no查询
    J->>DB: 退避重试
  else 终态失败
    J->>DB: recoverycase + 告警
  end
  S->>DB: 更新refunded_minor/订单售后/财务事实/outbox
```

### 8.9 微信支付公钥轮换

```mermaid
sequenceDiagram
  participant O as 双人运维
  participant S as Secret Manager
  participant A as Api/Jobs
  participant WX as 微信支付
  O->>S: 加入新公钥，旧key保留inactive，新key设active
  S-->>A: 发布新secret version并滚动重启
  A->>A: 启动校验恰好一个active
  A->>WX: 新请求携带新Wechatpay-Serial
  WX-->>A: 回调可能仍用新/旧序列号
  A->>A: 按序列号选择对应公钥验签
  O->>O: 观察至少覆盖最大回调重试与退款周期
  O->>S: 确认无旧serial流量后移除旧key
```

## 9. 每个模块内部的数据流

所有写模块共同执行：`HTTP/Job输入 -> exact validation -> 身份/Scope/能力/风险 -> application command -> domain policy -> repository/port -> transaction + outbox/audit -> response`。所有查询共同执行：`query validation -> Scope/RLS -> repository keyset query -> DTO脱敏 -> ETag/response`。下面列出每个限界上下文的独有内部流，不用重复实现通用逻辑。

| 模块 | 输入 | 内部顺序 | 自有事实 | 输出 |
| --- | --- | --- | --- | --- |
| `identity` | 密码、OAuth code、ticket | 校验事务→交换微信code→应用哈希定位→KMS加密→会话/绑定凭据 | principal、credential、federatedidentity、session、wechatgrant | session、CSRF、脱敏主体 |
| `access` | actor、membership、operation、scope | membership有效性→Scope锚点→角色能力→显式deny→MFA要求 | role、permission、membership授权 | authorization decision/evidence |
| `capability` | operation和模块能力 | 合同注册→依赖闭包→target校验 | capability catalog | 可执行能力集合 |
| `risk` | actor/device/amount/operation | 采集signal→RiskEngine→allow/challenge/review/deny→case | policy、signal、decision、case | 风险裁决 |
| `organization` | 平台/分销/集团/商城命令 | 校验父子类型→维护closure/path→发出组织事件 | unit、relation、scope anchor | 组织树与Scope |
| `partner` | 供应商/门店/渠道关系 | 主体校验→关系策略→合同状态→Scope绑定 | partner、agreement、store | 合作资源 |
| `member` | 注册、资料、地址、资格 | 身份关联→字段规则→KMS加密PII→版本更新 | profile、address、preference | 脱敏会员视图 |
| `qualification` | 企业、员工、商城资格 | 规则匹配→有效期→冲突决策→结果固化 | policy、grant | 购买资格 |
| `catalog` | provider商品、人工商品命令 | 规范化→分类/品牌校验→SKU聚合→发布状态 | product、sku、listing | 可检索商品投影 |
| `pricing` | listing、Scope、数量、时间 | 基础价→渠道/集团/商城价→促销→限购→取整 | pricebook、rule、offer | 服务端报价行 |
| `inventory` | stock snapshot、reserve/release | 单一库存源→锁SKU→扣可用/加预留→写reservation | stock、reservation、movement | availability和预留结果 |
| `experience` | 页面装修文档 | schema校验→组件白名单→引用检查→hash→发布快照 | draft、publication | 多端不可变体验文档 |
| `cart` | listing、quantity、selection | Scope/会员购物车→商品可售校验→数量策略→版本CAS | cart、cartitem | 服务端购物车 |
| `checkout` | cart、地址、配送、支付选择 | 并发读取价/库存/资格/券/福利→拒绝原因→tender plan→过期快照 | quote、quoteline | 权威报价 |
| `order` | quote id、幂等键 | 固定锁序→重验quote→库存预留→订单聚合→支付intent→outbox | orderrecord、orderline、statehistory | order id/read model |
| `payment` | order、scene、回调、退款 | 应用隔离→attempt→provider port→观测→状态机→结算/恢复 | 本文第6节支付表 | prepay、payment、refund、event |
| `voucher` | 卡池导入、绑定、核销、冻结 | 批次校验→KMS加密券码→状态策略→账本→outbox | batch、voucher、binding、ledger | 可用券和核销事实 |
| `benefit` | 企业福利入账、支付腿、退款腿 | 账户锁→余额/冻结校验→复式方向流水→幂等提交 | account、entry、allocation | 余额与流水 |
| `fulfillment` | payment.succeeded、供应商回执 | 按商品类型路由→provider下单→状态归一→补偿/死信 | fulfillment、shipment、delivery | 履约状态/物流 |
| `verification` | 动态会员码/核销码 | 签名校验→时窗/门店/次数规则→原子消费 | code、verification | 核销结果 |
| `channel` | 同步、下单、取消、退款、对账任务 | registry选provider→小能力接口→vendor adapter→标准结果→checkpoint | connection、checkpoint、command | 渠道事件/标准错误 |
| `extension` | manifest、版本、配置引用 | manifest校验→权限/契约校验→启停策略→registry装配 | extension、installation | 可用provider注册 |
| `finance` | capture/refund/statement | 事件去重→分录规则→账期归集→差异匹配→结算/发票 | journal、entry、statement、settlement | 账单、结算、发票 |
| `reporting` | 领域outbox | event projector→幂等offset→指标聚合→导出快照 | projection、metric、exportjob | 大屏、报表、导出 |
| `support` | 会话、消息、工单 | 分配规则→会话聚合→SLA计时→脱敏资源关联 | conversation、message、ticket、sla | 客服工作台 |
| `notification` | 领域事件/人工通知 | 偏好→模板→渠道选择→幂等dispatch→回执/退避 | template、preference、dispatch | 站内信/短信/微信/邮件 |
| `audit` | 命令、授权、配置和恢复操作 | canonicalize→hash→append-only保存→异步归档 | auditevent、archive | 可验证审计证据 |
| `runtime` | outbox、inbox、job | claim lease→心跳→执行→指数退避→deadletter | job、lease、inbox、outbox | 可恢复异步执行 |
| `marketing` | 活动/促销规则 | 资格→时间窗→预算→叠加策略→命中证据 | campaign、rule、budget | pricing输入 |

支付模块内部的对象协作：

```mermaid
flowchart LR
  Ops[PaymentOperations] --> Lifecycle[PaymentLifecycle]
  Ops --> Ref[PaymentReference]
  Ops --> Gateway[PaymentGateway port]
  Gateway --> Adapter[WechatGateway]
  Adapter --> Protocol[wechat extension]
  Ops --> Settle[PaymentSettlement]
  Ops --> RefundPlan[RefundPlanner]
  Jobs[PaymentJobs] --> Gateway
  Jobs --> Settle
  Jobs --> RefundPlan
  Jobs --> RefundSettle[RefundSettlement]
  Settle --> Allocation[AllocationPolicy]
  RefundPlan --> Allocation
  Ops --> Recovery[PaymentDeadletter/Recovery]
  Jobs --> Recovery
```

微信协议扩展内部的数据流：

```mermaid
flowchart LR
  Input[严格类型输入] --> Config[Config校验]
  Config --> Model[Models规范化]
  Model --> Crypto[Crypto签名/解密]
  Crypto --> Transport[Transport deadline/header]
  Transport --> Wechat[微信API v3]
  Wechat --> Signature[Signature按serial验签]
  Signature --> Parser[Models响应校验]
  Parser --> Client[Client最小结果]
  Notify[Notification raw body] --> Signature
  Signature --> NotifyCrypto[AES-GCM]
  NotifyCrypto --> NotifyModel[交易/退款强校验]
```

## 10. 失败矩阵与恢复策略

| 失败点 | 可观察状态 | 自动动作 | 人工动作 | 禁止动作 |
| --- | --- | --- | --- | --- |
| 身份code无效/过期 | `WECHAT_CODE_REJECTED` | 重新开始OAuth/wx.login | 查AppID/Secret配置 | 重用旧code |
| OAuth state错误/重放 | 认证失败和安全审计 | 无 | 查可疑来源 | 跳过state |
| OpenID属于另一AppID | `WECHAT_IDENTITY_REQUIRED`或context mismatch | 引导当前场景登录/绑定 | 查应用关系 | 借用另一个OpenID |
| 预支付明确4xx | attempt failed | 允许新尝试 | 查请求字段/商户产品权限 | 标记paid |
| 预支付超时/断连 | attempt unknown | 立即查单 | recovery requery | 直接重复创建订单 |
| 微信响应签名未知serial | protocol error + 告警 | 不接受响应 | 同步公钥并双人复核 | 关闭验签 |
| 回调签名错误/过期 | 4xx + 安全指标 | 无 | 查攻击/WAF/时钟 | 解密或入库 |
| 回调重复 | inbox duplicate | 幂等204 | 无 | 重复结算 |
| 同event id不同hash | 冲突告警 | 拒绝 | 安全事件处理 | 覆盖旧证据 |
| 金额/币种/付款人/AppID不符 | integrity mismatch | 拒绝 | 冻结case并查商户记录 | “按本地金额修正” |
| SUCCESS回调丢失 | intent pending | query job补偿 | recovery requery | 依赖客户端ok |
| 关单与付款竞态 | 二次query | 承认SUCCESS或确认CLOSED | 查看observation | 仅凭close 204判未支付 |
| 取消后迟到付款 | late capture | 全额原路退款 | 追踪退款异常 | 隐藏收款事实 |
| 退款请求超时 | providerattempt unknown | query refund | retryrefund case | 创建新退款号重复退 |
| 财务/履约/通知后效应失败 | effect retry/deadletter | 独立重试 | recovery replay | 回滚已确认支付 |
| 数据库不可用 | API 5xx/not ready | 平台重启/故障转移 | 数据库runbook | 降级到内存成功 |
| 密钥库不可用 | 启动失败或调用失败 | 告警/重试读取 | 恢复密钥服务 | 使用源码默认密钥 |

## 11. 安全与隐私威胁模型

| 威胁 | 控制 |
| --- | --- |
| 伪造微信回调 | 原始body + timestamp + nonce + serial按微信公钥RSA验签 |
| 重放真实回调 | 时间容差、provider event唯一、body hash冲突检测 |
| 回调密文篡改 | AES-256-GCM认证解密，associated data和nonce均参与 |
| 跨AppID OpenID混用 | 共享App catalog + `scene/application_hash`持久化和回调比对 |
| SSRF/恶意回调URL | 配置只接受公网HTTPS且启动期校验，不接受运行时URL |
| 私钥泄漏 | Secret Manager/KMS引用、最小workload权限、日志脱敏、定期轮换 |
| 客户端篡改金额 | 金额只来自服务端quote/order/payment intent |
| 重复扣款 | request claim、provider reference、attempt状态和查单恢复 |
| 重复退款 | refund idempotency、out_refund_no唯一、providerattempt序列 |
| 越权退款/恢复 | membership + capability + Scope/RLS + MFA + audit |
| SQL越权 | 请求事务设置数据库上下文，表启用Scope规则；provider callback只通过受控operation |
| XSS窃取凭据 | HttpOnly/Secure/SameSite Cookie、短期CSRF、OAuth code一次性；不在localStorage存身份密钥 |
| OAuth登录CSRF | state事务、PKCE、单次消费、回调URL固定 |
| 供应链凭据泄漏 | Excel只视为需求文档，任何旧明文凭据必须轮换并从密钥库读取 |

## 12. 并发、性能与可用性

### 12.1 同步快路径

- 商品/体验/报价查询允许并行读取无依赖数据；下单写路径按确定锁序串行化同一资源。
- 创建支付时只在短事务内锁intent/order；KMS和微信HTTP都在提交之后执行。
- 微信HTTP有截止时间和AbortSignal；读取类操作只对协议标注可重试错误做有界重试。
- 回调只做验签、解密、完整性校验、Inbox和Job入库，随后立即204；财务/履约不阻塞回调。
- 查询使用keyset pagination和针对`application_hash,intent_id,requested_at`的部分索引。
- 多个API实例通过数据库唯一约束共享幂等；多个Jobs实例通过claim/lease共享任务。

### 12.2 目标SLO

| 指标 | 目标 |
| --- | --- |
| 普通读取API p95 | ≤ 250ms（不含公网provider） |
| 创建支付本地事务 p95 | ≤ 100ms |
| 创建预支付端到端 p95 | ≤ 2s，p99 ≤ 5s |
| 微信回调接收 p95 | ≤ 500ms |
| SUCCESS回调至订单paid p95 | ≤ 3s |
| 回调丢失时主动查单收敛 | ≤ 30s |
| 同一订单重复扣款 | 0 |
| 支付金额/币种完整性错误漏放 | 0 |
| 支付后效应最终完成率 | ≥ 99.99%，剩余全部进入可见recovery |
| 可用性 | API月度≥99.95%，支付异步收敛≥99.99% |

### 12.3 容量模型

- 独立限制`payment.intents.create`、provider webhook、后台退款、recoveries四类流量。
- Job worker按`kind`设置并发；查询、退款、财务effect隔离舱，避免退款拥塞拖垮支付确认。
- 同一intent/refund保持单飞；跨订单可并发。
- 对微信429/系统繁忙使用带抖动指数退避，遵守`Retry-After`；不使用无限重试。
- Inbox原始body按合规保留期归档，业务表只保存摘要；报表从投影读取，不扫描热支付表。

## 13. 可观测性、告警和审计

统一上下文：`trace_id`、`request_id`、`operation_id`、`actor_id`、`membership_id`、`scope_id`、`order_id`、`intent_id`、`attempt_id`、`provider_request_id`。不得记录OpenID和密钥明文。

必备指标：

- `wechat_prepay_total{scene,outcome}`、延迟直方图、unknown比例。
- `wechat_response_signature_failure_total{serial}`、`wechat_unknown_serial_total`。
- `wechat_webhook_total{kind,outcome}`、验签失败、解密失败、完整性失败、重复和hash冲突。
- `payment_query_lag_seconds`、pending年龄、close/query冲突数、late payment数。
- `payment_capture_total`、`payment_refund_total{state}`、退款处理年龄。
- `payment_effect_backlog{kind}`、`runtime_job_backlog{kind}`、deadletter和open recovery数量。
- 订单金额与微信金额差异、日报账单差异、AppID场景冲突均为P0安全告警。

告警分级：

| 等级 | 条件示例 | 处置 |
| --- | --- | --- |
| P0 | 重复扣款、金额错配漏放、私钥疑似泄漏、账实不平 | 立即停止新支付、保留回调和查单、启动事件响应 |
| P1 | 验签集中失败、unknown serial、pending持续增长、退款超SLA | 15分钟内响应，检查密钥/微信平台/网络 |
| P2 | 单渠道错误率升高、少量effect deadletter | 当班处理并创建recovery |
| P3 | 容量趋势、旧key仍有少量流量 | 计划调整 |

## 14. 代码目录与文件责任

上位基线的全系统目录以[福利商城根治实施方案第7节](./福利商城根治实施方案.md#7-最终代码目录)为准。以下是本次微信生产链路的完整责任树；业务文件使用简洁语义名，迁移、测试和配置按约定允许下划线或连接符。

```text
smart-wing/
├── apps/
│   ├── auth/
│   │   └── src/
│   │       ├── app/routes.tsx
│   │       ├── features/session/
│   │       │   ├── AuthForm.tsx
│   │       │   └── Authorization.ts
│   │       ├── features/wechat/
│   │       │   ├── WechatAuthorization.ts
│   │       │   ├── WechatBindingForm.tsx
│   │       │   ├── WechatLoginButton.tsx
│   │       │   └── index.ts
│   │       └── pages/
│   │           ├── AuthCallbackPage.tsx
│   │           └── WechatCallbackPage.tsx
│   ├── storefront/
│   │   └── src/
│   │       ├── app/StorefrontApp.tsx
│   │       └── features/payment/
│   │           ├── WebPayment.ts
│   │           ├── api.ts
│   │           ├── index.ts
│   │           ├── model.ts
│   │           ├── route/PaymentRoute.tsx
│   │           └── ui/Payment.tsx
│   └── miniapp/
│       ├── miniprogram/
│       │   ├── api/client.js
│       │   ├── application/identity.js
│       │   ├── application/order.js
│       │   ├── payment/wechat.js
│       │   └── page/paymentresult/
│       └── tests/payment/wechat.test.cjs
├── packages/
│   └── config/src/
│       ├── WechatApplication.ts
│       ├── index.test.ts
│       └── index.ts
├── extensions/
│   └── payment/wechat/
│       ├── src/
│       │   ├── Client.ts
│       │   ├── Close.ts
│       │   ├── Config.ts
│       │   ├── Crypto.ts
│       │   ├── Models.ts
│       │   ├── Notification.ts
│       │   ├── NotificationModels.ts
│       │   ├── Signature.ts
│       │   ├── Transport.ts
│       │   └── index.ts
│       ├── test/TestKeys.ts
│       ├── Client.test.ts
│       ├── Close.test.ts
│       ├── Core.test.ts
│       └── Notification.test.ts
├── services/
│   └── commerce/
│       ├── .env.example
│       ├── .env.jobs.example
│       └── src/
│           ├── bootstrap/CommerceRuntime.ts
│           ├── foundation/http/HttpResponse.ts
│           ├── modules/identity/
│           │   ├── WechatOperations.ts
│           │   ├── application/port/WechatIdentity.ts
│           │   └── infrastructure/adapter/
│           │       ├── WechatIdentityGateway.ts
│           │       └── WechatIdentityGateway.test.ts
│           └── modules/payment/
│               ├── PaymentDeadletter.ts
│               ├── PaymentJobSupport.ts
│               ├── PaymentJobs.ts
│               ├── PaymentModule.ts
│               ├── PaymentOperationSupport.ts
│               ├── PaymentOperations.ts
│               ├── PaymentWebhook.ts
│               ├── PaymentPort.ts
│               ├── application/
│               │   ├── PaymentSettlement.ts
│               │   ├── RefundPlanner.ts
│               │   ├── RefundSettlement.ts
│               │   └── port/PaymentGateway.ts
│               ├── domain/
│               │   ├── model/PaymentReference.ts
│               │   └── policy/
│               │       ├── AllocationPolicy.ts
│               │       └── PaymentLifecycle.ts
│               └── infrastructure/adapter/WechatGateway.ts
├── database/supabase/migrations/
│   └── 20260821055000_isolate_wechat_payment_applications.sql
├── 04_tools/scripts/audit/database-contracts.mjs
├── 03_quality_ceshi/tests/browser/MvpServer.mjs
├── 05_docs_ziliao/docs_wendang/runbooks_yunwei/paymentincident.md
└── 05_docs_ziliao/docs_wendang/
    ├── 福利商城功能清单.xlsx
    ├── 福利商城根治实施方案.md
    ├── 测试环境验收-会员与支付.md
    └── 微信支付生产接入与MVP验收.md
```

## 15. 浏览器MVP模拟规范

### 15.1 测试的边界

`03_quality_ceshi/tests/browser/MvpServer.mjs`是确定性的、仅本地的MVP编排服务。它验证页面发出的API路径、顺序和输入，覆盖：

`会话 -> 发布首页 -> 商品/价格/库存 -> 加购物车 -> 地址/券/福利/发票 -> 权威报价 -> 下单 -> create payment(scene=jsapi) -> 服务端订单从authorizing变为paid -> 结果页轮询`。

它返回测试预支付参数并模拟服务端终态，因此：

- 可以证明页面没有跳过报价、下单和`scene=jsapi`；
- 可以证明支付结果页不依据客户端返回直接宣称成功；
- 不可以证明RSA签名被微信接受、用户真实扣款、微信回调到达或商户账单入账；
- 不得作为生产依赖、feature flag、fallback或演示模式打进bundle。

### 15.2 可复现启动

终端A：

```bash
MVP_API_PORT=4310 node 03_quality_ceshi/tests/browser/MvpServer.mjs
```

终端B：

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4310 \
NEXT_PUBLIC_AUTH_BASE_URL=http://127.0.0.1:4173 \
NEXT_PUBLIC_CLIENT_VERSION=1.0.0 \
NEXT_PUBLIC_MALL_ID=mall:test \
npx vite --host 127.0.0.1 --port 4173 apps/storefront
```

浏览器操作：

1. 打开`http://127.0.0.1:4173/`，确认首页标题“真实协议链路验收”。
2. 进入商品详情，把“有机纯牛奶礼盒”加入购物车。
3. 打开购物车，数量为1并进入结算。
4. 选择已脱敏地址，创建报价；确认应付¥25.90且tender为wechat。
5. 创建订单，进入`/payment?order=order%3Amvp`。
6. 普通浏览器没有微信桥时应明确显示`WECHAT_WEB_PAYMENT_ENVIRONMENT_REQUIRED`，不得假成功。
7. 专用UI编排测试可在页面加载前注入只用于测试的`MicroMessenger` user agent与`WeixinJSBridge`，让桥返回`get_brand_wcpay_request:ok`；随后必须进入结果页并等待服务端paid。
8. 打开`http://127.0.0.1:4310/mvp/evidence`，保存完整calls，确认支付请求body包含`order:mvp`和`scene:jsapi`。

必须保存的浏览器证据：首页、商品、购物车、报价、支付页、处理中、服务端paid结果页、`/mvp/evidence`、控制台无未处理异常、网络请求序列。

### 15.3 本次实际执行记录

2026-08-21的本地执行中：

- 独立MVP API成功监听`127.0.0.1:4310`；
- 在浏览器之外对该隔离服务重放了16次权威API调用，商品、购物车、报价¥25.90、订单、`scene=jsapi`支付请求和最终`paid`状态全部满足断言；这只证明测试编排服务自洽，不改变浏览器验收结论；
- storefront SSR曾因初始化阶段读取`window`返回500，已改为服务端稳定初始路径并在`useEffect`同步浏览器路径；
- Vinext开发服务器只绑定IPv6后，改用Vite显式绑定`127.0.0.1`并验证HTTP 200；
- 随后内置浏览器按URL安全策略拒绝继续导航/刷新；依据浏览器工具规则未绕过策略、未换用另一浏览器伪造证据；
- 因此本次没有完成页面点击录制和截图，浏览器验收状态保持“未通过/工具阻断”，不是“通过”。

## 16. 测试矩阵与质量门

| 层级 | 必测项 |
| --- | --- |
| 配置单测 | exact shape、双AppID、重复场景、相同AppID、URL、PEM、32字节API v3密钥、active key唯一 |
| 加密单测 | 商户RSA签名、客户端paySign、AES-GCM成功/篡改失败、OpenID hash |
| HTTP协议单测 | Authorization canonical string、时间戳、nonce、body、超时、响应大小、redirect禁止 |
| 响应验签 | active key、保留inactive key、未知serial、错误签名、过期时间戳 |
| 通知单测 | payment/refund、mchid、AppID、金额、币种、payer、event type、重复、超大body |
| 身份单测 | miniapp/JSAPI不同endpoint、固定callback、state、私网URL拒绝、UnionID自动关联 |
| 支付领域单测 | 全状态迁移、混合支付分配、退款腿、迟到支付 |
| 数据库契约 | 唯一键、CHECK、RLS、Inbox幂等、Job claim、迁移fresh replay |
| 集成测试 | commit-before-provider、unknown查单、回调入Inbox、查单settle、关单竞态、退款查询 |
| 前端组件 | 微信环境检查、bridge ready、cancel/fail、服务端轮询、SSR无window访问 |
| 小程序 | `scene=miniapp`、requestPayment参数、结果回读 |
| 浏览器journey | 第15节完整流程和证据 |
| 生产验收 | 第18节真实¥0.01支付、回调、账单和退款 |

推荐门禁顺序：

```bash
npm run check:cleaninstall
npm run check:supplychain
npm run check:generated
npm run check:requirements
npm run audit:architecture
npm run check:lines
npm run check:deployment
npm run typecheck
npm run check:migrations
npm run test:sql
npm run test:unit
npm run test:contract
npm run test:integration
npm run test:adapters
npm run test:component
npm run test:journey
npm run test:security
npm run test:performance
npm run build
npm run check:bundles
npm run audit:prod
```

### 16.1 2026-08-21实际门禁证据

| 门禁 | 实际结果 |
| --- | --- |
| 微信支付协议扩展 | 4个测试文件、27项测试通过，含保留旧公钥验签与固定通知路径 |
| Commerce单元测试 | 28个测试文件、109项测试通过 |
| 配置 | 7项通过，含双AppID、重复和私网地址拒绝 |
| 认证前端 | 7项通过 |
| Storefront | 4项通过，含`scene=jsapi`请求断言 |
| 小程序 | 16项通过，含`scene=miniapp`、支付取消/失败和权威轮询 |
| 全工作区单元测试 | 所有声明测试的workspace通过 |
| 合同 | Commerce 7项及Excel优先级1 provider精确集合测试通过 |
| 组件 | auth、console、miniapp、store、storefront、supplier、design全部通过 |
| MVP旅程 | 127项通过，覆盖MVP03至MVP23及11个provider |
| 安全 | 6项通过，覆盖跨Scope、MFA、Origin/CSRF、安全响应头和body上限 |
| 性能 | 2项通过，路由预算与provider bulkhead并发上限均满足 |
| 架构审计 | naming、boundary、ownership、duplicate、call、transaction、frontend、provider、extension、job、runtime graph、hard cut全部通过 |
| 数据库轻量重放 | 140个迁移通过；历史94、repair 46；不安全库存切换被原子拒绝 |
| 真实PostgreSQL 16重放 | 140个迁移与目标schema验证通过 |
| 真实PostgreSQL集成 | repository/RLS/Inbox/Job租约通过；发布恢复12项通过 |
| PostgreSQL + Redis适配器 | migration catalog、queue claim、NX/PX租约与重复拒绝通过 |
| 类型检查 | 全workspace通过 |
| 生产构建 | auth、console、miniapp、store、storefront、supplier、全部package与Api/Jobs/Migration/Smoke bundle通过 |
| Bundle审计 | 7个产物存在，预算满足，无退役或simulation替代代码 |
| MVP隔离API重放 | 16次调用通过，终态`paid`且支付scene为`jsapi` |
| 浏览器点击录制 | 未通过：内置浏览器URL策略阻断 |
| 真实微信资金 | 未执行：未提供商户凭据和微信客户端验收条件 |
| 生产依赖漏洞在线审计 | 未执行：执行环境拒绝向npm上传私有依赖树；需用户明确批准元数据外发 |

额外执行的仓库级`prettier --check`发现767个既有文件不符合Prettier默认格式。该命令不在项目`quality`门禁中，且直接全量格式化会制造大范围无关改动并可能破坏299行产品源码预算，所以本次未改写用户现有767个文件；代码质量以项目自有命名、边界、重复、行预算、类型和测试门禁为准。

## 17. 发布、回滚和硬切换

### 17.1 发布顺序

1. 轮换工作簿中曾出现过的任何真实渠道凭据，完成安全事件记录。
2. 在微信平台完成AppID-商户号关系、授权目录、OAuth域名、API v3密钥和微信支付公钥配置。
3. 在Secret Manager创建三份配置，分别授予API/Jobs最小读取权限。
4. 备份数据库并执行fresh replay、迁移清单和目标head断言。
5. 先部署不接流量的`ApiMain`/`JobsMain`，确认配置严格校验、readiness和数据库契约通过。
6. 以测试商城/测试会员完成真实¥0.01支付、查询、通知、账单和退款。
7. 灰度开放员工商城支付入口，观察unknown、验签失败、pending年龄、退款和账实差异。
8. 放量后删除历史模拟RPC、模拟按钮、旧配置键和不可达兼容分支；生产bundle审计必须证明不存在。

### 17.2 回滚裁决

- 应用回滚只能回到同一目标schema和同一真实支付合同的上一版本；不得回滚到simulation或旧AppID混用版本。
- 数据迁移是硬切换；新列可由上一安全版本忽略时允许应用回滚，否则使用向前修复迁移。
- 支付入口关闭不等于停止回调、查单和退款。事故期间必须继续接收微信回调并运行reconciliation。
- 密钥泄漏时：先在微信平台/密钥库轮换，再部署新version，最后撤销旧key；绝不把旧key写回代码临时恢复。
- 已发生的支付、退款、provider observation、Inbox、audit不得删除或覆盖。

## 18. 真实资金验收清单

只有下列证据全部存在，才允许将“真实微信支付”状态改为Released。

### 18.1 准备

- [ ] 正式或微信允许的验收商户号可用，JSAPI产品权限正常。
- [ ] 小程序和公众号AppID均已绑定商户号，AppID与配置hash核对一致。
- [ ] 公众号网页授权域名、JSAPI支付授权目录、支付回调URL均已生效。
- [ ] 商户私钥和序列号匹配；API v3密钥匹配；当前微信支付公钥ID可验签。
- [ ] 测试会员分别取得miniapp和jsapi场景OpenID，数据库application hash不同且UnionID关联符合预期。
- [ ] 测试订单金额固定为¥0.01，商品、库存、地址、发票、券/福利腿可追踪。
- [ ] 告警、日志、Trace、数据库查询和微信商户平台账单均由验收人员可访问。

### 18.2 公众号JSAPI支付

- [ ] 在真实微信客户端内进入员工商城，完成公众号OAuth。
- [ ] 首页→商品→购物车→报价→下单完整执行，无客户端金额覆盖。
- [ ] create payment的scene为`jsapi`，微信请求appid为公众号AppID，payer openid属于该AppID。
- [ ] 微信支付面板显示正确商户名、订单描述和¥0.01。
- [ ] 用户确认支付，客户端先显示处理中；服务端回调/查单后才显示成功。
- [ ] 微信交易号、商户订单号、金额、AppID、payer hash在微信平台和数据库一致。
- [ ] 同一按钮快速双击、刷新、重放HTTP幂等键均只有一笔真实扣款。

### 18.3 小程序支付

- [ ] `wx.login`使用小程序AppID，支付scene为`miniapp`。
- [ ] JSAPI下单appid和payer openid都属于小程序AppID。
- [ ] `wx.requestPayment`参数验签通过，¥0.01支付成功。
- [ ] 小程序端同样只以服务端订单终态显示成功。

### 18.4 回调、丢回调与迟到支付

- [ ] 正常回调验签/解密成功，HTTP 204无body，Inbox仅消费一次。
- [ ] 重放同一回调不重复capture、不重复履约、不重复财务分录。
- [ ] 测试环境阻断回调时，主动查单在30秒内收敛paid。
- [ ] 在支付边界模拟取消/过期竞态，真实SUCCESS被识别为late payment并自动创建全额退款。

### 18.5 退款与财务

- [ ] 对¥0.01订单发起全额退款，退款号唯一，微信退款终态为SUCCESS。
- [ ] 重放退款请求不产生第二笔退款。
- [ ] payment/refund/订单/售后/福利或券账户/财务分录金额完全一致。
- [ ] 微信账单和资金账单可下载，交易与退款均能按商户订单号匹配。
- [ ] 日终对账差异为0，或每个差异都有recovery case和责任人。

### 18.6 证据包

- [ ] 微信客户端全流程录屏与关键截图，隐去个人信息和交易敏感信息。
- [ ] `/mvp/evidence`浏览器编排证据与真实交易证据分目录保存，禁止混淆。
- [ ] API/Jobs Trace、回调event id、provider request id、微信transaction id、refund id建立索引清单。
- [ ] 数据库只读核对SQL输出、商户平台交易截图、账单行和退款行归档。
- [ ] 产品、研发、测试、财务、运维、安全六方签字和时间戳齐全。

## 19. 运行手册

### 19.1 pending订单持续增长

1. 看`payment_query_lag_seconds`和微信API错误码，不先重放预支付。
2. 按intent读取最新attempt的scene/AppHash/outTradeNo和observation。
3. 用同一scene/AppID主动查单；SUCCESS则幂等settle，NOTPAY且过期才关单。
4. 关单后再次查单；仍不确定就开recovery，不修改数据库伪造终态。

### 19.2 unknown serial

1. 立即保留原始headers/body hash，不能跳过验签。
2. 在微信商户平台通过双人复核取得对应微信支付公钥ID和SPKI公钥。
3. 将新key加入`platformKeys`并设置正确active状态，旧key保留。
4. 滚动部署，确认历史事件和新事件都能验签；分析为何密钥发布滞后。

### 19.3 金额或AppID不匹配

1. 视为P0完整性事件，停止新支付入口但保持回调/查单/退款。
2. 保存微信证据、本地intent/tender/attempt和配置version，禁止人工改金额“对齐”。
3. 核对是否跨AppID OpenID、错误商城、错误密钥version或provider reference碰撞。
4. 只有根因修复、账实核对和安全复核完成后恢复入口。

### 19.4 退款卡住

1. 读取`providerattempt`最新outcome和微信refund id。
2. 使用原`out_refund_no`查询，不创建新退款号。
3. SUCCESS则幂等执行`RefundSettlement`；PROCESSING退避；ABNORMAL/CLOSED进入recovery。
4. 财务人工处理也必须通过recovery request记录原因和证据hash。

## 20. 官方协议依据

实现和生产配置必须以微信支付官方文档为准，不从博客复制签名代码：

- [JSAPI/小程序下单](https://pay.weixin.qq.com/doc/v3/merchant/4012791856)
- [调起支付参数](https://pay.weixin.qq.com/doc/v3/merchant/4013070756)
- [支付通知](https://pay.weixin.qq.com/doc/v3/merchant/4012791861)
- [API v3请求签名](https://pay.weixin.qq.com/doc/v3/merchant/4012365342)
- [微信支付公钥验签](https://pay.weixin.qq.com/doc/v3/merchant/4013053249)
- [关闭订单](https://pay.weixin.qq.com/doc/v3/merchant/4012791839)
- [微信支付公钥常见问题](https://pay.weixin.qq.com/doc/v3/merchant/4013038816)
- [微信支付公钥产品说明](https://pay.weixin.qq.com/doc/v3/merchant/4012153196)

## 21. Definition of Done

一个微信支付需求只有同时满足以下条件才算完成：

1. 契约、实现、数据库、前端、测试、运行手册和监控同时变更；没有第二份配置或重复逻辑。
2. 单测、类型检查、数据库fresh replay、合同、集成、安全、性能、构建和生产bundle审计全部通过。
3. 小程序与公众号AppID隔离测试通过；未知公钥序列号、回调篡改、金额错配和重复事件全部fail closed。
4. 浏览器MVP证据完整；若工具阻断则状态明确为未通过，不能签字豁免。
5. 真实微信客户端完成公众号和小程序各一笔¥0.01支付，并完成至少一笔全额退款。
6. 商户平台交易、回调/查单、数据库支付事实、订单、库存、福利/券、履约、财务分录和账单完全闭合。
7. 灾难恢复、公钥轮换、pending、迟到支付、退款异常和deadletter演练有证据。
8. 历史模拟、fallback、兼容分支、旧配置键和工作簿明文凭据不在生产依赖图或生产bundle中。

未满足第4或第5项时，交付状态只能是“代码已接入，验收未完成”，不能写“真实支付上线”。
