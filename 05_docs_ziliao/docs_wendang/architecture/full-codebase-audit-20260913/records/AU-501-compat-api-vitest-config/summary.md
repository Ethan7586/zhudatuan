# AU-501｜Compatibility API Vitest 配置深审

- 审阅对象：`01_core_hexin/services/commerce-api/vitest.config.ts`（9 行）。
- 方法：人工审阅完整配置；静态追溯本包 `test` script、测试目录和仓库部署检查。未执行测试。

## 结论

- **G0**：`@smart-wing/commerce-api` 的正式 `test` script 以该文件作为 `vitest run` 配置；它只收集 `src/api/**/*.test.ts`，以 Node 环境运行，并显式隔离父目录 Vite 配置。
- 该 package 还含 compatibility Admin server；其测试是否另有入口、以及已声明的 API glob 是否足以覆盖该退役/兼容路径，不能仅从此配置推断。部署检查把 `commerce-api` 列为 retired，具体运行状态待相应发布/compat 模块证据确认。
- 未发现新增 P0–P3。未运行 Vitest，故 collection、环境隔离和实际测试结果未验证。
