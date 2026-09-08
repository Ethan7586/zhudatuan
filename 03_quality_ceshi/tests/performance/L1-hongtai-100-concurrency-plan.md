# L1「宏泰甄选」100 人并发全链路模拟｜执行前判据

## 1. 测试边界

- 测试节点：L1 `mall-zhudatuan`，对外名称「宏泰甄选」。
- 运行位置：本机一次性 PostgreSQL 17 容器；每次使用唯一 `run_id`，结束后销毁容器。
- 并发定义：每档虚拟用户由同一个闸门同时释放；记录最早与最晚启动时间，100 人启动跨度必须 `<= 1,000 ms`。
- 真实实现：数据库迁移、Identity 注册挑战/注册/手机 OTP 登录/票据交换、访问会话解析、商品查询、购物车、报价、订单、支付结算任务、售后申请/审批/退款任务、最终查询。
- 测试替身：短信只投递到内存 debug 收件箱；微信预支付、支付查询和退款结果由确定性测试网关返回，不产生网络或资金动作。
- 不覆盖：真实运营商短信延迟、真实微信网络延迟、TLS/反向代理、浏览器渲染、生产主机容量。

## 2. 接口、依赖与数据表

| 阶段 | 契约/实现入口 | 关键依赖 | 每用户测试数据 | 成功结果 |
|---|---|---|---|---|
| 注册挑战 | `identity.challenges.create` / `POST /api/v1/identity/challenges` | Identity API 角色、KMS 测试封装、`runtime.job` | 唯一手机号、`run_id`、L1 storefront slug | `202`；唯一 challenge；产生 1 条短信任务 |
| 短信送达 | `IdentityNotificationJobProcessor` + `JobRunner` | Jobs 角色、debug 收件箱 | challenge 对应 6 位验证码 | 任务 `completed`；不调用阿里云；验证码只归属该用户 |
| 注册 | `identity.members.create` / `POST /api/v1/identity/members` | scrypt 密码策略、L1 注册政策 | 唯一 principal/member/membership | `201`；L1 storefront membership 唯一且 active |
| 登录 | `identity.sessions.create` / `POST /api/v1/identity/sessions` | 密码校验、session/ticket 持久化 | 唯一 session token、PKCE/state/nonce | `201`；密码登录成功；session 与用户一一对应 |
| 票据交换 | `identity.tickets.exchange` / `POST /api/v1/identity/tickets/exchange` | 当前 session cookie、一次性 ticket | ticket/state/nonce/verifier | `200`；ticket 仅消费一次；返回 storefront 目标 |
| 商品查询 | `catalog.listings.read` / `GET /api/v1/catalog/listings` | 会话解析、L1 scope、目录投影 | 共享 L1 测试 listing | `200`；只读到 `mall-zhudatuan` 商品 |
| 加购 | `cart.items.put` / `PUT /api/v1/carts/current/items/{listingid}` | 用户 owner scope | 唯一 cart，数量 1 | `200`；购物车仅属于当前 member |
| 改数量 | `cart.items.put` + `cart.current.read` | 同上 | 数量从 1 改为 2 | `200`；读取数量为 2，无数量回退 |
| 报价 | `checkout.quote.create` / `POST /api/v1/checkouts/quotes` | 测试地址 fixture、库存/价格 | 唯一 quote | `201`；金额为 2 件商品总额 |
| 提交订单 | `order.orders.create` / `POST /api/v1/orders` | quote、库存预占、幂等记录 | 先发一轮并发首次请求，再以同键发一轮并发重放 | 两轮响应逐用户指向同一 order；数据库只有 1 单 |
| 模拟支付 | `payment.intents.create` + `PaymentJobProcessor(paymentquery)` | 确定性微信测试网关 | 唯一 intent/payment/transaction | 预支付 `201`；任务后 order=`paid`、payment=`captured` |
| 售后申请 | `order.aftersales.apply` / `POST /api/v1/orders/{id}/aftersales` | 已支付订单、owner scope | `kind=refund`；首次与同键重放分两个并发波次 | 两轮响应逐用户指向同一 aftersale；数据库只有 1 条 |
| 审批与退款 | `order.aftersales.approve` + `PaymentJobProcessor(paymentrefund)` | 独立测试运营身份直接调用实际审批用例、确定性退款结果 | 唯一 refund | 退款任务完成；aftersale=`completed`、order=`refunded` |
| 最终读取 | `order.orders.read` / `GET /api/v1/orders?order={id}` | 原用户 session/scope | 当前用户订单聚合 | 只包含自己的订单；payment=`refunded`、aftersale=`resolved` |

## 3. 分档与指标

执行顺序固定为 `1 → 10 → 100`；任一档功能错误即停止，不用更大并发掩盖。每档记录：阶段请求数、成功率、吞吐量、p50/p95/p99/最大耗时、端到端总时长、启动跨度、DB 连接峰值、队列峰值与排空时间、进程 CPU/内存（可获取时）、5xx 等价异常、超时、冲突、幂等重放结果与状态回退。

密码哈希、注册应用操作和短信 provider 分开报告：

- `password_hash_benchmark`：同一 `PasswordPolicy` 的独立并发基准；
- `registration`：真实注册操作总耗时（包含其内部密码哈希和数据库事务）；
- `sms_debug_provider`：debug 收件箱处理耗时；
- `sms_queue_wait`：challenge 完成至 debug 收件箱收到验证码的排队等待。

## 4. 运行前穷举结果表

| 结果类别 | 可观察结果 | 判定 |
|---|---|---|
| 全部通过 | 100 人启动跨度 <=1 秒；全部阶段 100%；隔离检查 0 缺陷；5xx/超时 0；本链路 identity/payment/refund 队列排空；DB 未耗尽 | `通过` |
| 功能失败 | 任一预期状态码/领域状态不符，或任一用户未走完整流程 | `未通过`，停止放大并报告首个阶段 |
| 隔离失败 | 跨用户/跨节点读取，session 串号，cart/order/aftersale 归属错位 | `严重失败`，立即停止 |
| 幂等失败 | 同键重放生成重复订单、重复支付、重复售后或重复退款 | `严重失败` |
| 状态失败 | 数量回退；订单/支付/售后状态倒退；产生孤儿记录 | `未通过` |
| 服务异常 | 领域调用抛出未处理异常（等价 5xx）、连接超时、事务冲突未收敛 | `未通过` |
| 队列失败 | identity/payment 队列未在超时内排空，存在 failed/deadletter | `未通过` |
| 数据库耗尽 | PostgreSQL 报连接耗尽，或连接等待超过池超时 | `未通过` |
| 环境阻塞 | Docker、迁移或受控 fixture 无法启动 | `未执行/未通过`，只报告首个阻塞点 |
| 指标不可得 | CPU/内存采样不可用，但功能与其他指标完整 | 功能判定不变；明确标记 `未采集` |

## 5. 最终证据

- 机器可读结果：`03_quality_ceshi/tests/performance/evidence/l1-hongtai-concurrency-latest.json`
- 中文结论：`03_quality_ceshi/tests/performance/L1-hongtai-100-concurrency-report.md`
- 测试入口：`04_tools/scripts/audit/l1-hongtai-concurrency.pg17-fixture.mjs`
