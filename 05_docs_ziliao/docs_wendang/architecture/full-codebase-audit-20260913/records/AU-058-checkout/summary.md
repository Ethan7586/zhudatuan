# AU-058｜checkout 结算报价与购买运行时深审

- `checkout.quote.create` 真实由两个运行单元提供：Commerce/WebBusiness 的完整 `CheckoutModule` 使用完整 Benefit/Voucher 适配器；Purchase API 用 `defineSelectedModule` 覆盖同一 operation，以 purchase session context、benefit gateway 与禁用 voucher gateway 收窄能力。两条入口均进入同一报价模型、稳定 HMAC 签名、`pricing.quote`、`checkout.session/evidence` 与 outbox，且 `ModuleOperations` 将命令包在同一事务和幂等记录内。
- QuoteReader 在报价时读取 active cart、listing/price/inventory、资格、活动、券和福利事实；订单创建重新签名/重算当前事实，地址默认值使用 member advisory lock 和部分唯一索引。Purchase 专用 RLS 进一步仅允许 benefit/Wechat tender，禁止券。
- F-0147（P2）：结算报价创建的关键行为没有专用测试。现有测试覆盖模块清单、地址默认并发语义、跨 Mall 历史隔离以及一个过期版本不变量；未覆盖公开 handler/Purchase handler 的签名、会话/evidence/outbox 原子写入、expectedVersion、15 分钟失效及 purchase-only voucher 拒绝链。
- 定向 Vitest 正式入口已尝试，但固定审计 worktree 缺少 `vitest` 可执行文件（退出 127）；未安装依赖、未改变运行状态。未发现 P0/P1。
