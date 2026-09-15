# AU-806｜工具仓库根定位器

- 审阅范围：`04_tools/scripts/lib/RepositoryRoot.mjs`（13 行）及直接调用者清单。
- 结论：模块从自身文件位置向上解析 realpath，并要求 root `package.json` 为私有 `zhudatuan-main`；在当前审计 worktree 的只读 import 返回该 worktree 根。它由静态门禁与PG17 fixtures共用，定为 **G0**，无新 finding。
- 边界：未运行会启动容器/数据库的调用者；该定位器只保证文件系统根身份，不证明调用者运行安全。
