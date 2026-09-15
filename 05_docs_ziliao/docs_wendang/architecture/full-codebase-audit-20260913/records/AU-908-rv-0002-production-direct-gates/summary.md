# RV-0002｜正式 Direct 发布门禁与回滚独立复核

## 边界与方法

- 固定审计基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- 从唯一生产 workflow 重新追到 release engine、remote agent 的 `stage-direct`/`activate-direct` 分支，并对现有反事实测试作定向执行；未复用首审回执来代替代码证据。
- 定向测试：`node --test --test-name-pattern='direct mode skips candidate and health checks' 04_tools/release-engine/test/remote-agent.test.mjs`，1/1 通过。未安装依赖、未构建、未连接生产节点。

## 独立事实链

1. `.github/workflows/deploy.yml:1-109` 是唯一名为 Deploy 的生产 workflow；其 plan（77）和 deploy（109）均固定传递 `--direct`，并以 `finalStatus === 'success'` 写入成功摘要。
2. `04_tools/release-engine/src/engine.mjs:114-120,398-447` 只在 production 且非 Direct 时要求 approval、执行 remote preflight、获取外部基线、做目标公网验收，并在失败时回滚。Direct 会直接走 `activate-direct`，这些分支均不执行。
3. `04_tools/release-engine/remote/agent.mjs:235-315,388-454` 证实 `stage-direct` 跳过 candidate checks，`activate-direct` 只核对 source SHA、移动 current/previous/runtime pointer 并尝试 restart；其异常恢复仅覆盖 pointer/restart 抛错，不会执行 readiness、Caddy 语义、protected-process、capacity 或自动健康回滚。
4. 上述定向测试专门配置 candidate check=exit 7、health check=exit 8，却断言 Direct `finalStatus='success'`，并已通过。这是行为规格的可执行反事实，而非静态推断。
5. `quality.yml` 可构建/验证/阶段化 candidate，但不会成为 `deploy.yml` 的前置条件；`zdt-adapter.test.mjs:285-302` 还明确断言 Direct workflow 不含 `approve-production`、`external-baseline` 或 production agent 安装流程。

## 裁决

- **F-0015 确认 P1，高置信度。** 当前唯一生产入口把“切换成功”定义为 pointer/restart 未抛错，未证明候选有效、服务就绪、Caddy 未漂移、受保护进程未受影响或真实公网可达。任何这些项失败时，发布仍可报告 success，故关键运行故障可持续到外部监控或用户报告。
- 此结论不声称 Direct 已造成 F-0001，也不声称任一具体生产发布已损坏数据；两者的因果和事故频率仍未验证。
- 不是 P0：没有 P0 所需的当前严重数据、安全事故或全系统中断直接证据。

## 后续独立修复批次的最小范围

1. 仅在当时最新 `zdt-next` 建立发布治理分支，定义 production success 的最小不可跳过门槛。
2. 选择 guarded production 路径，或把 Direct 改为明确先执行同等 candidate/preflight/readiness/external-acceptance/rollback 契约；不要在同一批混入业务、Caddy 或依赖变更。
3. 补充 workflow→engine→agent 的回归测试：candidate 失败、health 失败、Caddy 变化、受保护进程变化、目标公网 404、回滚失败都不得产出 success。
4. 修复时保留已知 Direct 回滚路径与失败回执兼容性，并在隔离环境验证后再按正式流程验收。

本复核只记录问题和验证结果，没有修复、发布、推送、合并或部署。
