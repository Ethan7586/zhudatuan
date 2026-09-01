# GitHub 分支关闭账本

这里记录 `zhudatuan` 旧 GitHub 分支的逐条关闭证据。

## 固定原则

1. 一次最多关闭一条远程分支。
2. 关闭前固定分支全名、tip SHA、独有提交数和存活承接线。
3. 涉及阿里云运行提交时，必须先建立不可变远程 Tag 或 Artifact Archive。
4. 关闭后重新读取 GitHub，验证分支消失、承接关系仍成立、远程分支数准确减少一条。
5. 每条记录必须给出恢复方法。
6. 远程删除后还要清理同名本地引用、失效 worktree 登记和残留目录；目录有内容时必须先做差异审计。
7. 未经 Ethan 明确同意，不进行下一条删除。
8. 同一次授权包含多条分支时，仍必须逐条复核、逐条删除、逐条验证，禁止合并为一次批量命令。

## 当前进度

| 编号 | 日期 | 关闭分支 | tip SHA | 独有提交 | 分支数变化 | 状态 |
|---:|---|---|---|---:|---:|---|
| 001 | 2026-09-02 | `codex/canonical-registration-release` | `71280439c5` | 0 | 32 → 31 | 远程与本地均已收口 |
| 002 | 2026-09-02 | `codex/purchase-readiness-finance-guard` | `9734c2ec06` | 0 | 31 → 30 | 远程与本地均已收口 |
| 003 | 2026-09-02 | `codex/graceful-preview-access-20260830` | `433e0b9401` | 0 | 30 → 29 | 远程与本地均已收口 |
| 004 | 2026-09-02 | `codex/dim-denied-surfaces-20260830` | `b933686885` | 0 | 29 → 28 | 远程与本地均已收口 |

当前 GitHub 远程分支数：`29`。001–004 累计关闭 4 条；2026-09-02 02:08 +08:00 另一个任务新增 `codex/hongtai-fullchain-release-20260902@483ee84`，因此数量从 28 回到 29，这不是本账本的关闭或创建动作。累计清理一个 `1.3G` 干净 worktree 和一个 `272M` 旧残留目录。

28 条中有 20 条相对其余远程 heads 的独有提交数为 0。逐条提交血缘、阿里云在线/历史 release 与本地 worktree 审计见 `../04-20条零独有分支逐条审计.md`；该审计只形成队列，没有新增删除动作。

## 记录

- `001-canonical-registration-release.md`
- `002-purchase-readiness-finance-guard.md`
- `003-graceful-preview-access-20260830.md`
- `004-dim-denied-surfaces-20260830.md`

机器可读证据位于相邻的 `../evidence/branch-closure-001-2026-09-02.json` 至 `../evidence/branch-closure-004-2026-09-02.json`。

当前 20 条零独有分支的机器可读审计位于 `../evidence/zero-unique-branches-20-2026-09-02.json`。
