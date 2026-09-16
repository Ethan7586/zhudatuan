# AU-756｜L1 并发链路与性能证据

- 审阅范围：L1 100 用户并发计划、历史报告、机器证据、端到端并发执行器和 runtime 性能 spec。
- 审阅方式：深入审阅运行器的环境边界、bootstrap、真实 HTTP/DB 路径、队列排空、断言和证据写入；深入审阅 runtime spec。计划/报告作为同一次历史运行的解释性证据做结构性复核，JSON 为运行器产物。
- 定向验证：执行正式入口 `npm run test:performance`。未启动 L1 容器压测。入口在加载 `runtime.spec.ts` 时因审计工作树缺少可解析的 `@shop/contract` workspace 链接而以 `ERR_MODULE_NOT_FOUND` 失败，零断言执行；未安装依赖或改变环境。根 workspace 和 `01_core_hexin/packages/contract/package.json` 均存在，故此处只记录为当前审计环境未验证，不据此认定产品缺陷。

## 审计结论

- **G0：L1 执行器、计划、报告和证据均有明确职责。** wrapper 创建并删除新鲜的本机 PostgreSQL 17 容器、回放数据库契约、为分离角色注入临时连接串后才执行 TypeScript runner；runner 以 `1 → 10 → 100` 顺序，在进程内真实 `HttpApp`、路由/契约、Cookie/CSRF、授权管线和 PostgreSQL 角色上走注册、登录、目录、购物车、报价、下单、支付、售后和退款，并检查幂等重放、跨用户/跨商城隔离、队列状态和 deadletter。
- **测试边界明确但不可外推。** 短信 debug dispatcher、微信 JSAPI 支付/查询/退款及测试 envelope KMS 是显式替身；HTTP 是进程内 transport，且容器与机器资源指标只代表 2026-09-09 的隔离本机运行，不证明公网、真实支付渠道、真实短信、集群、网络、长期容量或线上 p95。
- **历史证据与基线未漂移。** JSON 记录 `5e548b29c8a625b84d240e54be0c6dddf7c5c93e`、Node 22.22.3、PostgreSQL 17.11 和 `ALL_1_10_100_COHORTS_PASSED`；该 SHA 是本次固定基线 `5a1ce71eebbefaa826368a9e1dc17730f9363bc4` 的祖先。报告数值可由 JSON 的三档 tiers 对照，属于可追溯的历史证据，不是当前运行证明。
- `runtime.spec.ts` 只覆盖 RouteRegistry 查找预算和 provider bulkhead 最大并发/拒绝行为；它不是 L1 runner 的替代验证，也不覆盖数据库、HTTP、队列或真实 provider。
