# AU-760｜Linux readiness fixture

- 审阅范围：`04_tools/release-engine/test/linux-readiness-fixture.mjs`。
- 审阅方式：深入审阅输入收窄、systemd unit 属性、release/policy fixture、activate/verify/rollback/hard-fail/timeout 场景、sentinel/protected-process 断言与 cleanup。未执行。
- 未执行原因：该程序要求 Linux root，创建 systemd transient units，写入 `/opt/ai-delivery/fixtures/*`，并与现有 `/opt/sfl` production pointer/process snapshot 邻接；不符合本审计分支的只读、非部署边界。

## 审计结论

- **GX / DC-0082：禁止删除或在本机试跑。** 该 fixture 不是普通 unit test，而是隔离的 release-agent readiness/rollback drill；它检查 eventual-ready、hard failure、timeout 的 rollback，在 target/sentinel 生命周期变化后断言受保护 hbbtzn L1 unit 与 production pointer snapshot 不变。
- **隔离设计的静态证据：** root/path/unit/port 均使用严格 regex；transient target 配置 DynamicUser、ProtectSystem=strict、NoNewPrivileges、PrivateTmp、CapabilityBoundingSet 空集和 pointerRoot ReadOnlyPaths；cleanup 先 stop/reset 测试 unit，再只删除正则认可的 fixture root。
- **未验证项：** 仓内没有 launcher/环境变量生产者，实际专用 host、systemd version、launcher provisioning、cleanup receipt和与真实 agent policy 的兼容性未确认。没有把该缺口升级为删除候选或线上故障事实。
