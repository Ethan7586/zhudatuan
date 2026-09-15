# AU-747｜Zhudatuan registration 数据库交接与购买验收阻断

- 审阅范围：两份 DB role provisioning shell、registration boundary/运行摘要/step-up/sealed-schema reconcile SQL、bootstrap retirement SQL、ECS runbook 与 purchase E2E receipt schema。
- 审阅方式：深入审阅 role provisioning、registration boundary reconciliation、retirement 和购买 receipt/cutover 关键逻辑；对同构 digest reconcile 脚本结构性审阅。未执行 psql、systemd 或生产 E2E。

## 审计结论

- **G0：全部保留。** 两个 provisioner 要求固定 registration DB、精确私网 RDS 地址、32+ 密码、cluster authority、boundary sentinel 和无危险属性/成员关系；已有但不符合最终 login/noinherit 最小权限状态的角色会失败关闭而非自动修复。
- registration reconciliation 用 transaction/advisory lock 验证 bootstrap/migration 函数定义、sentinel、security-definer owner/search path、ACL 与 RLS，再把临时 bootstrap/migration 与 runtime 角色的 execute 集精确收敛；retirement SQL 是 full staging 的 one-shot systemd 输入，不能作为闲置脚本删除。
- ECS runbook 明确 purchase public cutover 必须保持 blocked、receipt 为 null，直至真实渠道 E2E 完成；receipt schema 将 release、DB/role、幂等、支付、库存、履约、回滚和负向路由证据绑定为一份契约。
- 实际 RDS authority、现有 ACL、迁移 receipt、WeChat 渠道 E2E 与主机 one-shot 删除均未验证。F-0296 已记录 purchase Caddy 自动门禁当前无法执行；因此不得把这些静态 SQL/receipt 视作上线证明。
