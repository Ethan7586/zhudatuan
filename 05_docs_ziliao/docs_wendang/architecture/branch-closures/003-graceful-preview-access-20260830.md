# 分支关闭 003：graceful-preview-access-20260830

> 完成时间：2026-09-02T00:55:59+08:00
> 状态：远程与本地均已收口
> 操作范围：GitHub 与本地分支引用；未连接、未修改阿里云

## 一、关闭对象

| 字段 | 值 |
|---|---|
| 远程分支 | `codex/graceful-preview-access-20260830` |
| 完整引用 | `refs/heads/codex/graceful-preview-access-20260830` |
| tip SHA | `433e0b94015f529585b95ecbcc3dbf971c39fe53` |
| tip Subject | `fix(console): make unavailable preview pages graceful` |
| tip 时间 | `2026-08-30T09:49:45+08:00` |
| 删除前远程分支数 | 30 |
| 删除后远程分支数 | 29 |

## 二、删除前证明

该分支 tip 是以下存活远程末端的祖先：

| 存活承接线 | 祖先检查 |
|---|---|
| `main` | 通过 |
| `codex/full-production-20260830` | 通过 |

相对两条稳定承接线的独有提交数为 `0`。tip 修改范围是 Console、Design Package、UI 配置及浏览器测试；对 `aliyun`、Caddy、systemd、部署脚本及 `infrastructure/zhudatuan` 的路径匹配数为 `0`。

## 三、本地检查

- 旧仓库中的同名本地分支与远端 tip 完全一致。
- 两个本地仓库均没有以该分支登记的 worktree。
- 没有发现以该完整分支名登记的专属残留目录。

## 四、关闭结果

- GitHub 同名远程引用：0。
- 两个本地仓库中的同名本地及远程跟踪引用：0。
- 同名 worktree 登记：0。
- 远程分支数从 30 减少为 29。
- `433e0b94...` 删除后仍由 `main` 和 `full-production` 承接。
- 阿里云连接、文件、路由、进程和 release：均未触碰。

## 五、恢复方法

```bash
git push origin \
  433e0b94015f529585b95ecbcc3dbf971c39fe53:refs/heads/codex/graceful-preview-access-20260830
```

该命令仅作为恢复说明，本次没有执行。

## 六、结论

第 003 条是已经被后代完整吸收的旧 UI 分支引用，没有独立代码资产。
