# 商品数据同源与微信支付 · 执行方案

版本：1.0　日期：2026-08-14　Owner：Ethan　执行方：Codex

目标两条：

1. **小程序完整显示所有商品，并与主 Shop 同源。**
2. **主 Shop 与小程序都能绑定微信并完成支付。**

---

## 0. 执行前必读

- `docs/SMART-WING-MALL-MASTER-CHARTER.md` §9 交易与支付、§16 安全与隐私
- `docs/mobile/WING-CODE-WECHAT-MINIAPP-MASTER-PLAN.md` §5 微信身份绑定、§8 组合支付
- `apps/wechat-miniapp/00-新任务从这里开始/10-小程序开发完全说明.md`
- `docs/VI-CONVERGENCE-EXECUTION-PLAN.md` 第 2 节禁止事项同样适用

**核心原则：服务端是唯一事实源。** 客户端提交的余额、资格、价格、支付结果一律不可信，服务端从会话与数据库重新加载（总纲 §13.3）。

---

## 1. 实测现状（2026-08-14 复核）

### 1.1 已经建好的

| 模块     | 文件                                                                                                                      | 状态                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 微信登录 | `services/commerce-api/src/api/wechatAuthRoutes.ts`                                                                       | 导出 `handleWechatSession` / `handleWechatBind` / `exchangeWechatCode`                         |
| 微信支付 | `wechatPayClient / Config / Crypto / Models / Notification / Signature / PaymentRoutes / PaymentNotificationRoute` + 测试 | 导出 `handleWechatPrepay` / `handleWechatPaymentStatus` / `handleOrderByNumber`                |
| 令牌会话 | `services/commerce-api/src/api/session.ts:165`                                                                            | **已支持 `Authorization: Bearer`**                                                             |
| 小程序侧 | `utils/catalogApi.js`、`utils/wechatPayment.js`、`utils/api.js`                                                           | 已调 `/auth/wechat/session`、`/auth/wechat/bind`、`/products`、`/orders`、`/orders/by-number/` |
| 数据库   | `20260814130000_wechat_order_payment_compliance.sql`                                                                      | 已存在                                                                                         |
| 商品目录 | `api_catalog_qualified` RPC                                                                                               | 资格过滤在服务端完成                                                                           |

**小程序没有 cookie 容器这堵墙已经拆掉了** —— `session.ts` 认 Bearer 令牌，`wechatAuthRoutes` 会签发 miniapp 会话令牌。

### 1.2 路由接线的真实状态（2026-08-14 复核）

> **处理器已经在当前工作区接线，但接线文件尚未纳入 Git；干净检出仍然没有这批能力。**
>
> `router.ts` 现在只负责分层调度，所以仅在这个文件中搜索 `wechat|prepay|notify` 会产生错误结论。实际注册位置是：
>
> - `routes/publicRouter.ts`：微信登录、首次绑定、微信支付通知
> - `routes/storefrontRouter.ts`：订单查询、预支付、支付状态
>
> 正确复核方式：
>
> ```bash
> grep -R -nE "auth/wechat|payments/wechat|payment-status|by-number" services/commerce-api/src/api/routes
> git status --short -- services/commerce-api/src/api/routes services/commerce-api/src/api/wechat\*
> ```

当前第一优先级不是重复写路由，而是验证公开/鉴权边界，把现有接线连同测试形成一个可回退提交。

### 1.3 其余缺口

| 缺口                                                                   | 影响                                                     |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| `member-code` 服务端完全不存在                                         | 会员码页只能显示标注过的模拟码                           |
| `apps/storefront-web/src/services/mallState.ts` 仍有 **20 处 `MOCK_`** | 主 Shop 与小程序不同源；`/home` 失败会静默回落到演示数据 |
| 商户号 / API v3 密钥 / 证书 / 私钥                                     | 未配置则支付无法真实发起                                 |
| request 合法域名白名单                                                 | 未配置则小程序请求被微信拦截                             |
| **开放平台 UnionID**                                                   | 见第 4 节，**这是唯一会改数据库设计的决定**              |

---

## 2. 第一步：核实并固化路由接线（半天，解锁其余全部）

**这是所有后续工作的前置。** 路由已经拆分注册，必须保持以下边界：

```
POST /api/v1/auth/wechat/session      handleWechatSession    ← 免鉴权（登录入口）
POST /api/v1/auth/wechat/bind         handleWechatBind       ← 免会话；一次性绑定凭证 + 账号密码 + 限流
GET  /api/v1/orders/by-number/{no}    handleOrderByNumber
POST /api/v1/orders/{id}/payments/wechat/prepay   handleWechatPrepay
GET  /api/v1/orders/{id}/payment-status           handleWechatPaymentStatus
POST /api/v1/payments/wechat/notify   微信异步通知   ← 免鉴权，靠验签
```

**注册位置很关键：**

- `auth/wechat/session` 必须在 `resolveAuthorizationContext` **之前**（用户此时还没有会话）
- `auth/wechat/bind` 同样在鉴权之前——它本身就是首次绑定并签发会话的入口；安全边界是一次性绑定凭证、既有账号密码和登录限流
- `payments/wechat/notify` 同理，**它的身份来自微信签名，不是用户会话**。放在鉴权之后会永远 401
- 其余全部在鉴权之后

**验收**

1. 路由边界回归测试证明 `session` / `bind` / `notify` 在用户鉴权之前分发
2. 路由边界回归测试证明 `prepay` 在用户鉴权之后，匿名请求返回 401
3. `wechatPaymentRoutes.test.ts` / `wechatAuthRoutes.test.ts` / `wechatPayNotification.test.ts` 全绿
4. 接线文件和依赖进入一个可回退提交
5. 配置真实服务器密钥后，小程序真机点一次登录，能拿到令牌

---

## 3. 商品数据同源

### 3.1 唯一正确的架构

```
                    PostgreSQL
                        │
              api_catalog_qualified  ← 资格/城市/限售过滤在这里，不在客户端
                        │
              GET /api/v1/products
                    ╱        ╲
        storefront-web      小程序
```

**两端只能有这一条路径。** 任何一端出现第二数据源，同源就是假的。

### 3.2 任务

**D-1｜切断 storefront-web 的 mock 生产路径**

- `mallState.ts` 现有 20 处 `MOCK_`。目标不是删文件，而是**让 mock 只在测试里出现，永不进入生产渲染路径**
- `/home` 或 `/products` 失败时必须显示显式错误态与重试，**不得回落到 `MOCK_USER` 的余额和 `MOCK_ORDERS` 的订单**
- 参照小程序分类页已有的六种同步状态：`local / syncing / live / empty / offline / auth`
- 未接通时页面顶部保留演示横幅，和小程序一致

**D-2｜小程序完整拉取商品**

`api_catalog_qualified` 是分页的。小程序当前 `catalogApi.js` 已在拉取，需确认：

- 游标循环直到 `nextCursor === null`，并设**上限页数**防止死循环
- 每页 `limit` 不超过 100
- 切页/退出时 `abort` 未完成请求（`category.js` 已有 `_loadVersion` 版本号模式，沿用）
- 失败按错误码分流，不要一律吞成"加载失败"

**D-3｜同步与异步的分工**

这条 Codex 在分类页已经做对了，推广到其余页面：

- **结构同步**：分类树、一级导航、页面骨架 —— 先渲染，不等网络
- **内容异步**：商品、余额、订单 —— 后台增强，带明确状态条
- **禁止整页白屏等待**（总纲 §15.3）
- 金额、库存、资格**不做乐观更新**（§15.3 末条）

**D-4｜缓存与失效**

- 稳定字典（分类树、权限摘要）可短时缓存
- **余额、库存、资格、订单必须短新鲜期 + 后台刷新**，不得长缓存
- 会员关系、角色、`authzVersion` 变化后旧缓存立即失效

**验收**

1. 同一账号在主 Shop 与小程序看到的商品集合一致（数量与 SKU 一一对应）
2. 断网时两端都显示离线态并可重试，**都不显示任何演示数字**
3. 资格不符的商品在两端都不出现（过滤在服务端，客户端拿不到）
4. `grep -rn "MOCK_" apps/storefront-web/src --include=*.tsx` 在生产路径上为 0

---

## 4. 微信支付

### 4.1 必须先解决的结构性问题

> **公众号 openid ≠ 小程序 openid。**
>
> Web 端 JSAPI 支付要用公众号（`wxbcbec8d29708e1c4`）拿到的 openid；
> 小程序支付要用小程序（`wx4df4137881a1d2bc`）拿到的 openid。
> 两者对同一个人是**不同的值**。
>
> 只有把两个应用绑定到**同一个微信开放平台账号**（open.weixin.qq.com，需企业认证），
> 才会下发共享的 **UnionID**。
>
> **不办 UnionID 的后果**：同一个员工在 Web 和小程序会成为**两个 Member**，
> 两份余额、两份订单历史、两份福利额度 —— 直接违反冻结决议第 3 条
> （一个真人只有一个 Member）。

**这一项 Ethan 未决。它影响数据库设计，越晚定改动越大。执行方不得自行选择，必须等确认。**

数据库需要的形态（待 UnionID 决定后落地）：

```
member_identities
  member_id      → members.id
  provider       'wechat_mp' | 'wechat_miniapp' | 'wecom' | 'local_phone' | 'local_username'
  open_id        该 provider 下的 openid
  union_id       开放平台 UnionID，可空
  UNIQUE(provider, open_id)
  INDEX(union_id)
```

绑定逻辑：**先按 `union_id` 找 Member，找不到再按 `(provider, open_id)` 找，都找不到才走绑定流程。** 绝不自动合并已有资产（总纲 §4.3）。

### 4.2 支付链路（总纲 §9.5，顺序不可改）

```
服务端创建订单，事务内锁定资格 / 库存 / 价格
  → 预占福利余额、餐卡、券、积分
  → 计算个人差额
  → 服务端向微信申请 prepay_id
  → 客户端 wx.requestPayment（小程序）/ JSAPI（Web）
  → 服务端验签处理异步通知 + 主动查单
  → 确认订单与福利扣减
  → 失败/超时释放预占
  → 退款原路退回并参与对账
```

**硬规则**

- **前端「支付成功」回调不是到账证据。** 只有服务端验签通过的通知 + 主动查单才算数
- 金额一律用「分」的整数，禁止浮点
- 账户扣减在数据库行锁与事务中完成，**分摊之和必须严格等于订单应付金额**
- 创建订单与发起支付都要**幂等键**，同一键不能提交不同内容
- 通知接口必须处理**重放**：同一 `transaction_id` 重复到达只生效一次
- 通知**金额不符**必须拒绝并告警，不得以微信金额为准覆盖订单
- 超时未支付**释放预占**，不能让福利余额被永久锁死

### 4.3 任务

**P-1｜路由注册** —— 见第 2 节；工作区已接线，待验证并入库

**P-2｜商户配置**

需要 Ethan 提供，**只进服务器环境变量，永不入仓库、不入客户端、不入截图**：

```
WECHAT_MCH_ID                商户号
WECHAT_API_V3_KEY            APIv3 密钥
WECHAT_CERT_SERIAL_NO        证书序列号
WECHAT_PRIVATE_KEY           商户私钥（PEM）
WECHAT_MP_APPID              公众号 AppID（Web 支付用）
WECHAT_MP_SECRET             公众号 AppSecret
WECHAT_MINIAPP_APPID         小程序 AppID
WECHAT_MINIAPP_SECRET        小程序 AppSecret
WECHAT_PAY_NOTIFY_URL        https://<域名>/api/v1/payments/wechat/notify
```

`wechatPayConfig.ts` 已存在，核对字段名一致即可。

**P-3｜两端各自的 openid 来源**

| 端                | 换 openid 的方式                          | AppID                            |
| ----------------- | ----------------------------------------- | -------------------------------- |
| 小程序            | `wx.login` → `code2Session`               | `wx4df4137881a1d2bc`             |
| 主 Shop（微信内） | 网页授权 `snsapi_base` → `code` 换 openid | `wxbcbec8d29708e1c4`             |
| 主 Shop（微信外） | **无法 JSAPI 支付**                       | 走 Native 扫码或提示在微信内打开 |

最后一行常被忽略：**在电脑浏览器打开的主 Shop 无法用 JSAPI**，必须另有方案或明确提示。

**P-4｜对账**

- 每日拉取微信对账单与本地流水比对
- 差异分三类：本地有微信无 / 微信有本地无 / 金额不符
- 每类都要有处理动作与责任人，不能只报差异
- `api_finance_reconciliation` 已存在，扩展它而不是另起一套

**验收**

1. 小程序真机完成一笔真实小额支付，订单状态由服务端通知确认
2. 主 Shop 在微信内完成一笔，微信外给出明确提示而不是报错
3. 断网重连、重复点击、重复通知，订单只成功一次
4. 故意构造金额不符的通知，服务端拒绝并告警
5. 超时未支付，预占的福利余额被释放
6. 退款原路退回并出现在对账中

---

## 5. 顺序与依赖

```
P-1 路由注册（半天）
   ├─→ D-2 小程序完整拉商品 ──┐
   ├─→ D-1 切断 Shop mock ────┼─→ D-3 同步/异步分工 → D-4 缓存失效
   │                          │
   └─→ P-2 商户配置 ─→ P-3 两端 openid ─→ P-4 对账
                          ↑
                    ⛔ 卡在 UnionID 裁决
```

**P-1 不做，其余全部空转。**
**UnionID 不定，P-3 之后的一切都可能推倒重来。**

---

## 6. 每次提交前

- [ ] `npm run check:miniapp` 与 `npm run check:vi` 通过
- [ ] 新增接口有测试；支付相关必须覆盖：验签失败、重放、金额不符、超时查单
- [ ] 未把任何密钥写入仓库（提交前 `git grep` 一遍商户号与密钥片段）
- [ ] 改动了服务端契约，同步更新 `packages/api-contract`
- [ ] 自己 `git commit`，不要把改动留在工作区

---

## 7. 交给 Ethan 的三个决定

| #   | 事项                         | 不定的后果                                                                |
| --- | ---------------------------- | ------------------------------------------------------------------------- |
| 1   | **开放平台 UnionID 办不办**  | 同一员工在两端变成两个 Member，两份余额与订单。**越晚定，数据库改动越大** |
| 2   | 商户号与 API v3 全套凭据     | 支付无法真实发起，只能停在模拟                                            |
| 3   | 微信外访问主 Shop 的支付方案 | 电脑浏览器用户无法付款                                                    |
