# AU-767｜Identity mobile consistency 与修复脚本

- 审阅范围：一致性读查询与四账户修复 SQL。
- 审阅方式：深入审阅 credential/profile/session join 条件、transaction/read-only boundary、repair target/precondition/collision guards、credential/account/session mutation及 commit。
- 验证：未运行。repair SQL 具有真实数据和会话失效副作用，超出审计分支权限。

## 审计结论

- **GX / DC-0085：禁止执行、删除或改写。** read query 以 active account 为锚，发现 credential/profile/session 的 realm/mobile/membership mismatch；repair 仅在四个明确 target、四项 mismatch、零 collision 时写入，并强制撤销受影响 account 的 live sessions。
- **未知项：** 固定基线无仓内 launcher；目标账户当前存在性、precondition 是否仍成立、手机 token/哈希是否匹配、修复是否已执行、生产登录和业务影响均未验证。
