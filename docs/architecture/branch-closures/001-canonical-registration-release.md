# 分支关闭 001：canonical-registration-release

> 完成时间：2026-09-02T00:26:18+08:00
<<<<<<< HEAD
> 本地清理时间：2026-09-02T00:34:13+08:00
> 状态：已完成并复核
> 操作范围：GitHub 远程分支引用及对应本地残留；未修改阿里云
=======
> 状态：已完成并复核
> 操作范围：GitHub 远程分支引用；未修改阿里云
>>>>>>> 0a6459e3 (docs(branches): record first legacy branch closure)

## 一、关闭对象

| 字段 | 值 |
|---|---|
| 远程分支 | `codex/canonical-registration-release` |
| 完整引用 | `refs/heads/codex/canonical-registration-release` |
| tip SHA | `71280439c562e483081fb3412a50ca3eb31f341b` |
| tip Subject | `test(security): remove secret-like fixture literals` |
| 删除前远程分支数 | 32 |
| 删除后远程分支数 | 31 |

## 二、删除前证明

该分支 tip 是以下三个存活远程末端的祖先：

| 存活承接线 | 祖先检查 |
|---|---|
| `codex/full-production-20260830` | 通过 |
| `backend-reconstruction` | 通过 |
| `main` | 通过 |

相对上述三个存活末端，该分支独有提交数为：

```text
0
```

因此删除的是冗余远程名称，不是删除提交内容。

## 三、生产保护前置动作

关闭第一条分支前，先保护了阿里云正在运行但不被任何 GitHub 远程分支包含的 Web Business API 提交：

```text
source commit:
443cdb06d4724ae799e29ee61e97a336d322ec5d

annotated tag:
prod-evidence/2026-09-02/web-business-api-443cdb0

tag object:
88c15060be2db630c767d97895ff98bac21b8052
```

远程 peeled tag 已验证精确指向 `443cdb06d4724ae799e29ee61e97a336d322ec5d`。

## 四、关闭结果

- GitHub 已不存在 `refs/heads/codex/canonical-registration-release`。
- 远程分支数从 32 减少为 31。
- `71280439...` 仍由 `full-production`、`backend-reconstruction` 和 `main` 完整承接。
- 删除后独有提交数仍为 0。
- `443cdb0` 已由远程生产证据 Tag 保护。
- `zdt-next` 未被旧历史合并。
- 阿里云未部署、未重启、未改路由、未改文件。

<<<<<<< HEAD
## 五、本地空间清理

两个本地仓库均已检查：

| 检查项 | 清理后结果 |
|---|---|
| `/Users/Ethan/Desktop/zdt-next` 同名本地引用 | 0 |
| `/Users/Ethan/Desktop/Projects/zhudatuan/main` 同名本地引用 | 0 |
| 同名远程跟踪引用 | 0 |
| 同名 worktree 登记 | 0 |
| 可修剪 worktree 登记 | 0 |

旧仓库原先仍有：

- 本地分支 `codex/canonical-registration-release`，指向 `71280439...`；现已删除。
- 失效管理项 `.git/worktrees/zhudatuan-auth-registration.MeOwKt`；其 `gitdir` 指向不存在的位置，现已修剪。
- 残留目录 `/private/tmp/zhudatuan-auth-registration.MeOwKt`，测得大小为 `272M`。

删除残留目录前，使用独立临时索引与 `71280439...` 对照：

- 166 个仍存在的受管文件内容全部与提交一致。
- 1,912 个受管文件仅为缺失，不构成独有内容。
- 208 个未跟踪文件全部位于 `dist`、`node_modules`、`.wrangler` 或 `tsconfig.tsbuildinfo` 等生成物范围。
- 非缺失型受管内容差异为 0，未发现未提交源码。

目录随后通过系统 `trash` 工具移入：

```text
/Users/Ethan/.Trash/zhudatuan-auth-registration.MeOwKt
```

最终复核时间为 `2026-09-02T00:36:35+08:00`。此时原 `/private/tmp` 路径和上述废纸篓路径均已不存在；没有清空或改动废纸篓中的其他项目。该分支对应的 `272M` 残留目录已不再保留在本地。

## 六、恢复方法
=======
## 五、恢复方法
>>>>>>> 0a6459e3 (docs(branches): record first legacy branch closure)

如需恢复原远程分支，可从固定提交重新创建：

```bash
git push origin \
  71280439c562e483081fb3412a50ca3eb31f341b:refs/heads/codex/canonical-registration-release
```

该命令仅作为恢复说明，本次没有执行。

<<<<<<< HEAD
## 七、结论

第 001 条关闭符合“有承接、无独有提交、生产先保护、远程与本地均收口、删除后可恢复”的标准。
=======
## 六、结论

第 001 条关闭符合“有承接、无独有提交、生产先保护、删除后可恢复”的标准。
>>>>>>> 0a6459e3 (docs(branches): record first legacy branch closure)

下一条分支必须重新执行完整取证，不因本次成功而自动获得删除授权。
