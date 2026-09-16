# RV-0047｜Runtime contract head checksum 对账独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0025
- 结论：**维持 GX；未发现 P0。**

迁移更新 `runtime.schemaversion` 的契约 head checksum，并在提交前 fail-closed。后续迁移以具体版本/checksum 作为前置条件，运行身份也读取 schema ledger；它是部署顺序、就绪门禁与恢复证据，不可删除或单独重放。未验证真实数据库 ledger、备份或发布控制面。
