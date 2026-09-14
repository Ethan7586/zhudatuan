# AU-533｜Password login PostgreSQL 稳定性测试

- 审阅范围：`01_core_hexin/services/commerce/tests/repository/PasswordLoginStability.test.ts`（156 行）；定向追踪 identity registration operations 与 fixture lifecycle。
- 审阅方式：逐段人工阅读；测试需要 admin/identity PostgreSQL endpoint，本轮未执行。

## 真实运行关系

Admin DB seed active principal/account/password credential/member/membership/scope grants → identity operation login → one-time ticket exchange → 查询 session/consumed ticket evidence。rounds 可在 1–1000 配置，错误密码必须返回 credential invalid。

## 审计结论

- **G0**：测试以真实 PasswordPolicy hash 和 PostgreSQL identity records 验证 repeated password login/ticket exchange，是认证稳定性规格；KMS/audit adapter 是有意识地隔离非本测试目标的依赖。
- **F-0254（P3，高置信）**：fixture 使用随机 suffix 直接插入多张 identity/access 表；afterAll 仅关闭 pool，没有 cleanup。重复执行会在共享测试 DB 累积 principal/account/credential/member/membership/session/authticket 等数据，增加污染、容量和后续测试选择性失败风险。

## 未验证项

- 未执行 test，未知外部 test harness 是否在文件外重置整个数据库；生产数据库、密码 hash cost、KMS 与真实 cookie/client 运行行为未验证。
