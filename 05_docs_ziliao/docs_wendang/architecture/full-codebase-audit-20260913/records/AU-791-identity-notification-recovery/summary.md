# AU-791｜身份通知恢复静态测试

- 审阅范围：`identity-notification-recovery.test.mjs`、两个 systemd unit、RealmOperationContext、RegistrationOperations 与 IdentityNotificationJobsRuntime。
- 审阅方式：深读 internal runtime restart 依赖、node notification scope 的创建/消费路径；运行只读 Node test。

## 审计结论

- **G0：保留。** 它是 identity notification worker 的 systemd recovery 与子节点通知 scope 静态回归测试。
- **F-0306 / P2：** 第一个 systemd subtest通过；第二个仍要求历史文字 `notificationScope ?? null`，实际 RegistrationOperations 已使用 `notificationScope ?? realm.nodeId`。该实际路径仍让 sovereign child 使用自身 manifest node id，且为没有 injected scope 的入口提供 realm node fallback；测试因旧文字失败，不能证明当前通知 scope 行为。
- **边界：** 本测试不启动 worker、不创建 runtime.job、不验证真实 retry/delivery；它只能证明静态 systemd/source 文本。
