# 分支关闭 001：canonical-registration-release

> 完成时间：2026-09-02T00:26:18+08:00
> 状态：已完成并复核
> 操作范围：GitHub 远程分支引用；未修改阿里云

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

## 五、恢复方法

如需恢复原远程分支，可从固定提交重新创建：

```bash
git push origin \
  71280439c562e483081fb3412a50ca3eb31f341b:refs/heads/codex/canonical-registration-release
```

该命令仅作为恢复说明，本次没有执行。

## 六、结论

第 001 条关闭符合“有承接、无独有提交、生产先保护、删除后可恢复”的标准。

下一条分支必须重新执行完整取证，不因本次成功而自动获得删除授权。
