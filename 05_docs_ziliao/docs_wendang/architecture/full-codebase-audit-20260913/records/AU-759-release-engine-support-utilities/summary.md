# AU-759｜Release-engine 支撑工具

- 审阅范围：工具说明、release-engine LAW/README、workspace isolation、isolated dependency preparation、related-test selector、error/glob/stable helpers。
- 审阅方式：三个纯 helper 与三个操作入口深入审阅；两份说明按其与根 LAW/release manifest 的关系做结构性审阅。Linux systemd readiness fixture 因会创建 `/opt`/systemd 实例，拆至下一独立 AU。
- 验证：未运行。dependency preparation 会修改 audit worktree 的 `node_modules`；related test 会调用 Vitest；二者不符合本阶段的只读审计验证边界。

## 审计结论

- **G0：说明、errors/glob/stable helpers、related-test selector 均保留。** root LAW 是规范上位来源；release manifest 为 storefront/auth/console/commerce 目标明确注册 `related-tests.mjs`。selector 仅在 changed path 落在目标 root 时调用 scoped Vitest，并用 `shell:false` 传递参数。
- **G1 / DC-0081：** `prepare-isolated-dependencies.sh` 和内部 workspace assertion 未见仓内静态启动者，但会准备发布工作树依赖并阻止外部 package link；可能由仓外 delivery/bootstrap 调用，不能按死代码删除。
- isolated dependency helper 只允许既有 `node_modules` donor，使用 hard-link 复制和 realpath/symlink containment check；是否适配当前正式 delivery host 未在本 AU 运行验证。
