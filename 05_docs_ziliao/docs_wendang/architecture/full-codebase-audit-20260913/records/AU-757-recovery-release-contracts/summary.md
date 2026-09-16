# AU-757｜恢复与发布契约测试

- 审阅范围：Console 制品、release manifest、stage/cutover evidence、runbook 完整性和 Storefront 静态资源回滚的五个 recovery specs。
- 审阅方式：五个职责不同，均深入审阅；反向核对 Console artifact、stage、cutover、asset-pool 的直接消费者。未运行会写入 Console 工作树 `dist`、调用 Vite build 或读取发布部署脚本的整组 recovery suite。
- 定向验证：`node --import tsx --test 03_quality_ceshi/tests/recovery/storefront-assets.spec.ts` 通过（2/2）。测试只使用临时目录和 `127.0.0.1` loopback HTTP；无外部服务、数据库或部署操作。

## 审计结论

- **G0：五个测试均是仍在正式 integration/recovery entry 中的发布安全契约。** Console spec 验证 immutable digest、source SHA、双节点绑定和篡改拒绝；deployment/release spec 对 signed release、stage、cutover、回滚证据和流量阶梯实行 fail-closed；runbook spec 验证已注册 job 与强制事故手册的最小主题；asset spec 验证哈希资源池的跨版本可读、immutable cache 与 collision refusal。
- **F-0298（P3）：** Console 的真实 Vite build 直接输出到应用工作树 `dist`，不具备 test-owned 输出隔离，因此本次没有运行该 spec。
- **测试边界：** deployment/runbook 主要是静态文本/fixture validation，不能证明 ACK、OSS、Caddy、真实 runbook 命令、发布审批或回滚在实际环境执行成功；deployment 对 runtime template 的文本断言也未覆盖 F-0294 的 Kubernetes API schema 问题。
