# 分支关闭 002：purchase-readiness-finance-guard

> 完成时间：2026-09-02T00:55:00+08:00
> 状态：远程与本地均已收口
> 操作范围：GitHub 引用与对应本地 worktree；未连接、未修改阿里云

## 一、关闭对象

| 字段 | 值 |
|---|---|
| 远程分支 | `codex/purchase-readiness-finance-guard` |
| 完整引用 | `refs/heads/codex/purchase-readiness-finance-guard` |
| tip SHA | `9734c2ec064e1e31765593a6a524a27d38bd9881` |
| tip Subject | `fix(commerce): verify denied finance function safely` |
| tip 时间 | `2026-08-29T03:02:36+08:00` |
| 删除前远程分支数 | 31 |
| 删除后远程分支数 | 30 |

## 二、删除前证明

该分支 tip 已被以下存活远程末端完整包含：

| 存活承接线 | 祖先检查 |
|---|---|
| `main` | 通过 |
| `codex/full-production-20260830` | 通过 |
| `backend-reconstruction` | 通过 |

相对上述稳定承接线的独有提交数为 `0`。删除的是已经完成汇入的分支名称，不会删除这次财务函数修复。

tip 只修改：

```text
services/commerce/src/bootstrap/PurchaseApiRuntime.test.ts
services/commerce/src/bootstrap/PurchaseApiRuntime.ts
```

对 `aliyun`、Caddy、systemd、部署脚本及 `infrastructure/zhudatuan` 的 tip 路径匹配数为 `0`。

## 三、本地清理

删除前存在一个登记中的专属 worktree：

```text
/private/tmp/zhudatuan-release-bef0989
```

清理前审计结果：

| 检查项 | 结果 |
|---|---:|
| worktree 大小 | `1.3G` |
| HEAD | `9734c2ec064e1e31765593a6a524a27d38bd9881` |
| 已修改受管文件 | 0 |
| 已暂存文件 | 0 |
| 未跟踪文件 | 0 |

远程删除成功后，通过 Git worktree 管理命令移除该目录与登记，再删除旧仓库中的同名本地分支，并在两个仓库中修剪远程跟踪引用。

## 四、关闭结果

- GitHub 同名远程引用：0。
- 两个本地仓库中的同名本地及远程跟踪引用：0。
- 同名 worktree 登记：0。
- `/private/tmp/zhudatuan-release-bef0989`：不存在。
- 释放的干净 worktree 空间：约 `1.3G`。
- `9734c2ec...` 删除后仍由 `main` 等存活线承接。
- 阿里云连接、文件、路由、进程和 release：均未触碰。

## 五、恢复方法

如需恢复原远程分支，可从固定提交重新创建：

```bash
git push origin \
  9734c2ec064e1e31765593a6a524a27d38bd9881:refs/heads/codex/purchase-readiness-finance-guard
```

该命令仅作为恢复说明，本次没有执行。

## 六、结论

第 002 条满足“零独有、稳定承接、不碰阿里云、本地无未提交资产、逐条验证”的关闭标准。
