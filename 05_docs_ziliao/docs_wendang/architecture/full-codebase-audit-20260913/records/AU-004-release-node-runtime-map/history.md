# AU-004｜历史取证

历史只用于解释设计来源；固定基线行为仍以当前代码、配置和可复现运行证据为准。

- [FACT][E-AU-004-014] `2a7eeb0aa0f54...` 的发布提交把旧的 green candidate、外部域名基线和 production approval 主路径替换为 `Deploy Direct`，提交与测试都明确保存 Direct 语义。因此 F-0015 不是根据名称猜测的偶然漏项。
- [FACT][E-AU-004-014] 固定基线提交 `5a1ce71eebbef...` 增加 Wuhan OSS Console 原子发布路径；成功 run 34730203670 证明它是可运行入口，不是仅存在于文档的草案。
- [FACT][E-AU-004-019] 基线后的 Direct runs 34731808987 与 34731736217 分别对 L0 Console/Auth 产生 `direct-activated` 成功回执；这证明入口被实际使用，也同时证明 success 不能替代公网健康，因为观察时两个 fufu入口均为404。
- [FACT][E-AU-004-010] 当前 active Caddy SHA 未匹配仓库全部45个历史 Caddy blobs；这只证明 active配置的精确文本不在仓库历史，不推断是谁、何时、为何修改。
- [FACT][E-AU-004-011] active agent/policy/gateway与部分units可映射到固定基线后的提交，Storefront unit也对应后续版本；线上快照因此不得写成固定基线的执行结果。
- [CONFLICT] 旧 `infrastructure/aliyun/deploy.sh` 已明确退出；storefront compatibility脚本仍拉取失效的 `origin/main` 并引用当前目录不存在的Caddy路径。两者没有正式runtime注册，但仍被deployment检查或历史恢复语境引用，本AU不作垃圾代码判断。

## 后续历史问题

1. active `/etc/caddy/Caddyfile` 的权威生成/安装来源和变更审计日志尚未取得。
2. Direct替换guarded流程时，业务上是否正式接受取消readiness、外部验收与自动健康回滚，需由第二位审计者和Ethan核对；提交意图不能代替当前产品决定。
3. AutoNode是否曾用于当前HBBTZN节点、其ledger与Cloudflare资源是否仍存在，需在外部资源只读专项确认。
