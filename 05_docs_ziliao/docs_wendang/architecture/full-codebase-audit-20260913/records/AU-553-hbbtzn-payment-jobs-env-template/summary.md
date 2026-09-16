# AU-553｜hbbtzn L1 payment jobs 环境模板

- 审阅范围：`02_platform_pingtai/config/node-runtime/hbbtzn-l1/payment-jobs.env.example`（18 行）；定向阅读 PaymentJobsRuntime、generic systemd、L0/L1 release targets 与 deployment check。
- 审阅方式：环境契约、启动/worker语义和发布入口人工追踪；未启动 worker/读取线上支付或 Secret Store。

## 真实运行关系

payment jobs env → generic `sfl-payment-jobs@.service` → PaymentJobsOnlyMain/ReadyMain → manifest validation → Secret Store DB/WeChat configs → payment query/refund QueueJob。runtime 逐项验证 node profile/checkout feature、secret/payment binding prefix、production lifecycle、DB role/schema/relation/function privileges 和 payment callback host/scope。

## 审计结论

- **F-0260 补强（P2）**：L1 template 的 database/payment refs、worker id、manifest/path/pointer 都指向 hbbtzn-l1，且 runtime 能验证这些绑定；但 hbbtzn deployment 及 remote policy 将 payment-jobs responsibility/target/restart 只声明给 `zhudatuan-l0`，L1 remote target 不含 payment-jobs。
- 没有实际 bearer/WeChat credential 值；所有 secret store bearer 为 placeholder。generic `%i` systemd 表明 L1 profile有潜在运行职责，不能仅因现行 L0集中调度而删除模板。
- 现有 `payment-jobs-deployment` 只检验 L0 legacy environment/unit；L1 静态 namespace/origin/pointer 由 AU-552 已通过的 domain-boundary gate 统一验证，未见 L1 payment worker artifact consistency 专用 gate。

## 未验证项

- 未验证 L0 delegation 是否是正式永久设计、真实 payment callback scope、DB job lease/重试、WeChat external execution和L1 future cutover流程。
