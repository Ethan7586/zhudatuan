# AU-722｜本地 Seed、迁移与 OTP 辅助编排

- 审阅范围：`04_tools/tools/seed/src/` 余下 12 个本地 seed/migration/OTP/verification 文件及其测试。
- 审阅方式：深入审阅本地环境入口、secret/KMS/clipboard、migration owner bootstrap、transaction/rollback和子进程调用；对应 source-contract tests作结构性审阅。未运行任何 local seed、migration、OTP copy 或 verify command。

## 运行关系

- `Migrate` 从 `localSeedEnvironment` 读取 local secret refs，处理 fresh local schema、owner bootstrap pending、commerce build和 migration runner；`Seed` 建立本地 Ethan/operator/storefront fixture及受限员工权限。
- OTP copy 仅限 macOS development、loopback HTTPS secret/KMS和 loopback Postgres，针对指定手机号读取未消费 registration challenge，解密后写入系统 clipboard，stdout只报告成功。
- Staging Owner Plan与生产 Owner Plan使用不同 endpoint、role、secret-store port和 confirmation；database access tests锁定 privileged role/SQL contract而不实际写库。

## 审计结论

- **G0：全部保留。** 这些命令是正式 local replay/seed/migration、测试 OTP 辅助和角色 SQL contract 的唯一编排层；无法以“仅本地”或固定 Ethan fixture认定无用。
- 没有新增问题。OTP 明文复制是该受限本地开发工具的明确输出，输入有 development/macOS/loopback/手机号/未消费 challenge 边界，不是静默日志泄露。
- 未运行测试：命令会读取/写入本地 secrets、数据库或 clipboard；本轮审计只读。

## 未验证项

- 未核验现有 local secret store、KMS、Postgres 角色/权限、clipboard process或迁移历史的真实状态。
- 未证明迁移及 seed 在当前基线完整成功；已有 F-0265 与 F-0293 的数据集约束风险仍按各自记录处理。
