# AU-539｜Commerce 默认 Vitest 测试分组

- 审阅范围：`01_core_hexin/services/commerce/vitest.config.ts`（33 行）；定向核对 contract/integration config 和 workspace scripts。
- 审阅方式：配置、测试入口及文件组边界人工阅读；未执行测试。

## 真实运行关系

`npm run test --workspace @shop/commerce` → 默认 Vitest config → `commerce-pglite`（七个指定 PGlite test，单文件串行、group 0）→ `commerce-parallel`（其余 `src/**/*.test.ts`，排除相同七个文件、group 1）；HTTP/event contract 和 repository/job integration 分别由独立 scripts/config 执行。

## 审计结论

- **G0**：PGlite 共享/重型持久化测试被显式列出并设为不并行，剩余源码单元测试通过 exclude 避免与该组重复；这是减少数据库 fixture 竞争、同时保留普通测试并行度的质量边界。
- 默认入口只收集 `src` tests，跨 HTTP/event 与 repository/job 测试不会被隐式混入，契约及 integration scope 由相应显式 command 决定。

## 未验证项

- 未执行三套 Vitest 命令；无法确认 glob/项目调度在当前 Vitest 版本下的实际匹配、PGlite fixture isolation、失败退出码，及 release control-plane 是否实际执行这些测试入口。
