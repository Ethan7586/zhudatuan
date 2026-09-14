# AU-564｜数据库历史迁移不可变清单

- 审阅范围：`02_platform_pingtai/database/contracts/history.json`（383 行）；定向阅读 migration inventory verifier 和 release artifact consumers。
- 审阅方式：清单结构、hash verifier、migration/release边界人工阅读；尝试正式 `npm run check:migration-inventory`，另以 Node standard library只读重算历史 SHA。

## 真实运行关系

history manifest → database-contracts inventory verifier → historical migration filename/order/SHA-256 immutability + repair sequence validation → migration release artifact candidate (`database/contracts/history.json` critical file) → database-owner forward-only migration executor。它是发布/恢复边界，不是应用进程运行配置。

## 审计结论

- **G0**：清单固定 head `20260820133000` 前 94 个 migration 的 SHA-256。独立只读重算结果为：algorithm sha256、count/entries/historical files 均为 94、顺序一致、hash mismatch 0；migration tree 共 300 个 SQL 文件。
- remote policy/release manifest 将 history.json 作为 database-migration artifact 的 candidate/critical file，保留其完整性直接影响历史迁移变更检测与 forward-only recovery。
- **正式验证未启动**：`check:migration-inventory` 在模块加载时因 worktree 找不到 `pg`退出，未执行其 repair migration sequence 或 object contract checks；未安装依赖/运行迁移。

## 未验证项

- 未验证 repair file list、300 migration的SQL语义/可重放性、production migration ledger、数据库 owner execution、backup snapshot或线上 schema/contract一致性。
