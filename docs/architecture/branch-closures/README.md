# GitHub 分支关闭账本

这里记录 `zhudatuan` 旧 GitHub 分支的逐条关闭证据。

## 固定原则

<<<<<<< HEAD
1. 默认一次关闭一条远程分支；Ethan 明确授权固定批次时，可以按授权数量批量关闭，但每条都必须有固定 tip SHA、独立祖先证明和 SHA 租约。
=======
1. 一次最多关闭一条远程分支。
>>>>>>> 0a6459e3 (docs(branches): record first legacy branch closure)
2. 关闭前固定分支全名、tip SHA、独有提交数和存活承接线。
3. 涉及阿里云运行提交时，必须先建立不可变远程 Tag 或 Artifact Archive。
4. 关闭后重新读取 GitHub，验证分支消失、承接关系仍成立、远程分支数准确减少一条。
5. 每条记录必须给出恢复方法。
<<<<<<< HEAD
<<<<<<< HEAD
6. 远程删除后还要清理同名本地引用、失效 worktree 登记和残留目录；目录有内容时必须先做差异审计。
7. 未经 Ethan 明确同意，不进行下一条删除。
8. 批量授权下允许一次推送多个删除 refspec，但每条必须单独配置 `--force-with-lease=<ref>:<expected-sha>`，并在动作前后核对精确集合与总数。
=======
6. 未经 Ethan 明确同意，不进行下一条删除。
>>>>>>> 0a6459e3 (docs(branches): record first legacy branch closure)
=======
6. 远程删除后还要清理同名本地引用、失效 worktree 登记和残留目录；目录有内容时必须先做差异审计。
7. 未经 Ethan 明确同意，不进行下一条删除。
>>>>>>> e254db12 (docs(branches): record local cleanup for closure 001)

## 当前进度

| 编号 | 日期 | 关闭分支 | tip SHA | 独有提交 | 分支数变化 | 状态 |
|---:|---|---|---|---:|---:|---|
<<<<<<< HEAD
<<<<<<< HEAD
| 001 | 2026-09-02 | `codex/canonical-registration-release` | `71280439c5` | 0 | 32 → 31 | 远程与本地均已收口 |
| 002 | 2026-09-02 | `codex/purchase-readiness-finance-guard` | `9734c2ec06` | 0 | 31 → 30 | 远程与本地均已收口 |
| 003 | 2026-09-02 | `codex/graceful-preview-access-20260830` | `433e0b9401` | 0 | 30 → 29 | 远程与本地均已收口 |
| 004 | 2026-09-02 | `codex/dim-denied-surfaces-20260830` | `b933686885` | 0 | 29 → 28 | 远程与本地均已收口 |
| 005–014 | 2026-09-02 | 10 条已继承分支，见批次记录 | 10 个固定 tip | 0 | 29 → 19 | 远程已收口；5 个任务 worktree 本地保留 |
| 015–025 | 2026-09-02 | 11 条旧线，见八分支收口记录 | 11 个固定 tip | 3 条有独立历史 | 19 → 8 | 远程已收口；独立历史已打 Tag；9 个干净 worktree 已清理 |

当前 GitHub 远程分支数：`8`。Ethan 明确要求保留本月在测的 `codex/hongtai-fullchain-release-20260902`，随后授权执行 19 → 8。015–025 批次关闭其余 7 条旧 `codex/*` 与 4 条旧 `ethan/*`；现在远端唯一保留的 `codex/*` 是宏泰测试线。

28 条中有 20 条相对其余远程 heads 的独有提交数为 0。逐条提交血缘、阿里云在线/历史 release 与本地 worktree 审计见 `../04-20条零独有分支逐条审计.md`；该审计只形成队列，没有新增删除动作。
=======
| 001 | 2026-09-02 | `codex/canonical-registration-release` | `71280439c5` | 0 | 32 → 31 | 完成 |
>>>>>>> 0a6459e3 (docs(branches): record first legacy branch closure)
=======
| 001 | 2026-09-02 | `codex/canonical-registration-release` | `71280439c5` | 0 | 32 → 31 | 远程与本地均已收口 |
>>>>>>> e254db12 (docs(branches): record local cleanup for closure 001)

## 记录

- `001-canonical-registration-release.md`
<<<<<<< HEAD
- `002-purchase-readiness-finance-guard.md`
- `003-graceful-preview-access-20260830.md`
- `004-dim-denied-surfaces-20260830.md`
- `005-014-inherited-branches-batch-20260902.md`
- `015-025-eight-branch-consolidation-20260902.md`

机器可读证据位于相邻的 `../evidence/branch-closure-001-2026-09-02.json` 至 `../evidence/branch-closure-004-2026-09-02.json`，以及两个批次证据 `../evidence/branch-closure-005-014-batch-2026-09-02.json`、`../evidence/branch-closure-015-025-batch-2026-09-02.json`。

当前 20 条零独有分支的机器可读审计位于 `../evidence/zero-unique-branches-20-2026-09-02.json`。
=======

机器可读证据位于相邻的 `../evidence/branch-closure-001-2026-09-02.json`。
>>>>>>> 0a6459e3 (docs(branches): record first legacy branch closure)
