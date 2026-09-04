# 分支关闭 015–025：收口为八条远程分支

> 完成时间：2026-09-02T03:31:00+08:00
> 状态：11 条远程引用及同名本地分支已收口；9 个干净 worktree 已清理
> 操作范围：GitHub 分支与归档 Tag、本地 Bundle、本地分支和 worktree；未连接、未修改阿里云

## 一、目标与保留原则

Ethan 明确要求保留 `codex/hongtai-fullchain-release-20260902`，因为它是 2026 年 9 月正在使用的宏泰测试线；随后授权把 GitHub 从 19 条收口为 8 条。

本批次保留：

| 分支 | 完成时 tip | 定位 |
|---|---|---|
| `backend-reconstruction` | `40a6c0c37c0d4e4314f33de724e1642329abf0ad` | WCHS 只读参考与定期下拉来源 |
| `codex/hongtai-fullchain-release-20260902` | `483ee84fcdb187bff88589e080ad054548b79dc5` | 本月宏泰测试线 |
| `ethan/iam-reliability-95` | `3e8da9344ad532b68315587afc86f79b3ac3be1e` | 当前包含宏泰测试提交的集成维护线 |
| `ethan/mall-phase1-integration` | `a93433b5c693d74003d3222019f81e213b0f2c4e` | 商城阶段集成线 |
| `ethan/order-release-31b27b7-20260901` | `25277ab7ab6d7e92e24ab23f0475c69b4635a9b9` | 有本地订单改动的活动线 |
| `ethan/order-release-forward-20260901` | `0ca2a5cdda792a41f060838685e3671db36bd880` | 订单前向独有历史 |
| `main` | `c36a8f917174d1bcb9d4f8d6328d14fe149a2a26` | GitHub 当前默认分支，暂存旧基线 |
| `zdt-next` | `35d3c255b34b597cbf3d9c93c954db33418d0004` | 唯一共享重构主轴 |

## 二、关闭对象与承接证据

| # | 关闭分支 | 固定 tip | 删除后的承接或归档 |
|---:|---|---|---|
| 015 | `codex/console-support-20260830` | `4f43dccad19bc120f74a91d4d48fea89e882f494` | `archive/full-production-20260830` |
| 016 | `codex/full-production-20260830` | `a509e3aedcd035d5fc4b66c1f8ddad88cc0e61b1` | 同 tip 远程归档 Tag |
| 017 | `codex/identity-notification-production-hotfix-20260901` | `a180ddfebffd100f97a4415695f836c82a6538b8` | 同 tip 远程归档 Tag |
| 018 | `codex/member-classic-ui-release-20260901` | `097421d9da84e219d6d633219a8bcd4089644222` | `ethan/iam-reliability-95` |
| 019 | `codex/member-invitation-success-92-20260901` | `810acfd17c88304b2664104668851354808fc945` | `ethan/iam-reliability-95` |
| 020 | `codex/product-000a-baseline-isolation` | `f8594a89f634eaaa97a4931ca430bf6890349052` | `ethan/iam-reliability-95` |
| 021 | `codex/production-access-denied-hotfix-20260830` | `1c77d92c4b5dcd8d91fee4601a20e0eda3597fe0` | `archive/full-production-20260830` |
| 022 | `ethan/identity-recovery-alerting-20260901` | `31b27b78ec88d6f5d24d80c7f3836e54bc8c76e9` | `ethan/iam-reliability-95` |
| 023 | `ethan/mall-001-mall-context` | `e44d18a7a82a7edc3cfa7383ec84d22ea3f34bb8` | `ethan/mall-phase1-integration` |
| 024 | `ethan/order-release-gates-20260901` | `c36a8f917174d1bcb9d4f8d6328d14fe149a2a26` | `main`，相同 tip |
| 025 | `ethan/registration-polish-20260901` | `01c376ee6ffbe87ed1d9e39e5c50fbf35cb6083e` | 同 tip 远程归档 Tag |

删除前没有开放 PR，也没有目标受到 GitHub 分支保护。每条删除 refspec 都配置了独立 `--force-with-lease=<ref>:<expected-sha>`。

## 三、恢复资产

本地完整 Bundle：

```text
/Users/Ethan/Desktop/zdt-next/06_history_lishi/archive_guidang/git-branches_fenzhi/github-prune-02-20260902-11-branches.bundle
```

- 大小：约 `22 MiB`。
- SHA-256：`8b1f65a040e37e535f1ec63f573192a2d2f1eeaa7938d4e9a85baf3b852e9d6e`。
- `git bundle verify`：通过，包含 11 条 ref 的完整历史。
- 临时仓库 fetch 与 11 条 head/SHA 对比：通过。
- 临时仓库 `git fsck --full --no-dangling`：通过。

3 条独立历史同时保存为 GitHub annotated Tag：

| Tag | 指向提交 |
|---|---|
| `archive/full-production-20260830` | `a509e3aedcd035d5fc4b66c1f8ddad88cc0e61b1` |
| `archive/identity-notification-hotfix-20260901` | `a180ddfebffd100f97a4415695f836c82a6538b8` |
| `archive/registration-polish-20260901` | `01c376ee6ffbe87ed1d9e39e5c50fbf35cb6083e` |

## 四、远程结果

- 删除前：`19` 条远程分支。
- 删除后：`8` 条远程分支。
- 11 条目标 ref：全部消失。
- 3 个归档 Tag：全部存在且 peeled SHA 正确。
- 远端只剩 1 条 `codex/*`：本月宏泰测试线。
- 阿里云、Caddy、systemd、数据库和运行服务：均未触碰。

## 五、本地清理

删除前逐个复核分支、tip SHA 与工作区状态。以下 9 个 worktree 均为零改动，已通过 `git worktree remove` 清理：

```text
/private/tmp/zhudatuan-access-hotfix-20260830
/private/tmp/zhudatuan-identity-recovery-alerting-20260901
/private/tmp/zhudatuan-registration-polish-20260901
/Users/Ethan/.codex/worktrees/member-classic-ui-release-20260901
/Users/Ethan/.codex/worktrees/member-invitation-92-20260901
/Users/Ethan/.codex/worktrees/product-000a-baseline-isolation-20260901
/Users/Ethan/.codex/worktrees/zhudatuan-identity-notification-hotfix-20260901
/Users/Ethan/Desktop/Projects/zhudatuan/tree/order-a01-release
/Users/Ethan/Desktop/Projects/zhudatuan/worktrees/mall-001
```

删除前名义体积合计约 `10 GiB`。11 个同名本地分支也已删除。

`/private/tmp/zhudatuan-full-production-20260830.worktree` 使用本地别名分支 `codex/full-production-login-closure-20260830`，存在 91 项未提交状态，因此完整保留，没有强拆、清理或改名。其已提交基线由归档 Tag 与 Bundle 双重保存，未提交现场仍只存在于该 worktree。

## 六、恢复方法

在任意空 Git 仓库中恢复 11 条本地分支：

```bash
git fetch \
  /Users/Ethan/Desktop/zdt-next/06_history_lishi/archive_guidang/git-branches_fenzhi/github-prune-02-20260902-11-branches.bundle \
  'refs/remotes/origin/*:refs/heads/*'
```

独立历史也可直接从对应 `archive/*` Tag 建立分支。恢复命令本次没有向远端执行。

## 七、结论

GitHub 已从 19 条收口为 8 条。宏泰测试线、当前集成线、商城线、两条订单线、旧默认分支、WCHS 参考线和 `zdt-next` 均保留；被关闭的提交历史仍由存活分支、远程归档 Tag 与本地 Bundle 承接。
