# 分支关闭 005–014：十条已继承分支批次

> 完成时间：2026-09-02T02:22:00+08:00
> 状态：10 条远程引用已收口；5 条无 worktree 的本地分支已删除；5 个任务 worktree 保留
> 操作范围：GitHub 分支引用、本地恢复 Bundle 与安全本地引用；未连接、未修改阿里云

## 一、授权与批次边界

Ethan 明确要求“一次性收窄 10 条”。本批次只从重新计算后已被 `main` 或当前生产分支 `ethan/iam-reliability-95@0d9bcb1` 完整继承的 16 条候选中选择。

为避免影响仍在讨论的商品、会员和订单任务，本批次保留了相应活动分支，关闭以下完成态或中间态引用：

| # | 远程分支 | 固定 tip | 存活承接线 |
|---:|---|---|---|
| 005 | `codex/console-modularization-release-20260831` | `0db535e2475c017dda8bb055344a240f6e2ae1b9` | `ethan/iam-reliability-95` |
| 006 | `codex/referral-preview-api-routing-fix` | `34e9f7fbbd606f079030426cdd713712096d3a48` | `main` |
| 007 | `codex/referral-preview-release-20260830` | `801e92ebadd3f2f19ed89b586cfcd6b5e609239a` | `main` |
| 008 | `codex/referral-preview-routing-fallback-20260830` | `f226e647ae76d647bf9d755b6eb078f87a2d37b5` | `main` |
| 009 | `codex/release-closure-20260901` | `0b9b10ec75930504b207299d031ec09ad5d85c10` | `ethan/iam-reliability-95` |
| 010 | `codex/runtime-readiness-repair` | `bd4e16dbd7fe2e8d5c54a7262f50e067a97cc33e` | `main` |
| 011 | `codex/unified-access-denied-20260830` | `58cb532cac642387f9f1bfd8d1f1c2a205f0088b` | `main` |
| 012 | `codex/vi-1-2-foundation-20260901` | `f7b13e239b496111d382190ed1c5a7abb7382dd3` | `ethan/iam-reliability-95` |
| 013 | `codex/zhudatuan-brand-unification-20260901` | `43c75fe7f8362f14a81f522a4e8c56317e362fcc` | `ethan/iam-reliability-95` |
| 014 | `ethan/iam-production-integration-20260901` | `ca9844f944c01b397bafac7563e79629acd06346` | `ethan/iam-reliability-95` |

每条候选 tip 相对其承接线的独有提交数均为 `0`。删除前没有开放 PR，没有候选受到 GitHub 分支保护。

## 二、恢复资产

本地恢复包：

```text
/Users/Ethan/Desktop/zdt-next/06_history_lishi/archive_guidang/git-branches_fenzhi/github-prune-01-20260902-10-branches.bundle
```

- 大小：约 `22 MiB`。
- SHA-256：`b5b7e62eb6bbf783fb8b7b5412fae465b1c7fa8b51abaf53e86600f60a45847e`。
- `git bundle verify`：通过，声明包含完整历史。
- Bundle heads：10 条，逐条与删除前远端 SHA 一致。
- 临时仓库 fetch：通过。
- 临时仓库 `git fsck --full --no-dangling`：通过。

Bundle、manifest 与校验和只保存在本地，不提交到 GitHub。

## 三、远程动作与结果

删除使用单次 `git push`，但每条 ref 都配置了独立的 `--force-with-lease=<ref>:<expected-sha>`。因此任意候选若在删除前被并发更新，对应租约就会拒绝删除，而不会静默抹掉新提交。

- 删除前远程分支数：`29`。
- 删除后远程分支数：`19`。
- 10 条目标远程 ref：逐条 `ABSENT`。
- `main@c36a8f9`：保留。
- `ethan/iam-reliability-95@0d9bcb1`：保留。
- `zdt-next@555a9fd`：保留。
- 阿里云：未连接、未修改、未重启服务。

## 四、本地处理

以下 5 条没有注册 worktree，本地分支已删除：

- `codex/referral-preview-api-routing-fix`
- `codex/referral-preview-release-20260830`
- `codex/referral-preview-routing-fallback-20260830`
- `codex/runtime-readiness-repair`
- `ethan/iam-production-integration-20260901`

以下 5 条仍登记在旧任务 worktree 中，因此没有强拆；它们不再占用 GitHub 分支数：

- `codex/console-modularization-release-20260831`：存在 2 个未跟踪目录，必须保留现场。
- `codex/release-closure-20260901`：worktree 干净。
- `codex/unified-access-denied-20260830`：worktree 干净。
- `codex/vi-1-2-foundation-20260901`：worktree 干净。
- `codex/zhudatuan-brand-unification-20260901`：worktree 干净。

这些本地 worktree 应在对应 Codex 任务确认结束或归档后单独清理，不能为追求目录整洁而破坏任务现场。

## 五、恢复方法

在任意空 Git 仓库中恢复全部 10 条本地分支：

```bash
git fetch \
  /Users/Ethan/Desktop/zdt-next/06_history_lishi/archive_guidang/git-branches_fenzhi/github-prune-01-20260902-10-branches.bundle \
  'refs/remotes/origin/*:refs/heads/*'
```

核对后，可按需把指定分支重新推送到 GitHub。恢复命令本次没有向远端执行。

## 六、结论

本批次收窄的是分支引用，不是删除代码历史。GitHub 已从 29 条降为 19 条；十条完整提交历史同时由存活承接线和本地可验证 Bundle 保存。
