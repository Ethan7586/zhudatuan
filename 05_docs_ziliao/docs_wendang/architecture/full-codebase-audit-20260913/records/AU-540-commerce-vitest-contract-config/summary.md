# AU-540｜Commerce HTTP/Event 契约测试入口

- 审阅范围：`01_core_hexin/services/commerce/vitest.contract.config.ts`（8 行）；定向清点 include 范围和 `@shop/commerce` script。
- 审阅方式：配置、静态测试入口与覆盖清单人工阅读；未执行测试。

## 真实运行关系

`npm run test:contract --workspace @shop/commerce` → contract Vitest config → `tests/http/Contract.test.ts` 与 `tests/event/Event.test.ts`；这两个目录不由默认 src unit test config 收集。

## 审计结论

- **G0**：config 将 HTTP route/operation contract 与 runtime event contract 显式隔离为 node-only suite，实际固定基线 include 下分别存在一份测试文件；没有冗余 glob 或无入口测试目录证据。
- release manifest 的可见 quality-gate 条目只显示 commerce typecheck；本轮未发现此 contract script 被该 control-plane 调用，但未扩展为缺陷，因为 CI/workflow/外部质量门和发布策略完整性尚未专项核验。

## 未验证项

- 未运行 suite，未核验两个测试是否有效覆盖实际所有 API/event producer-consumer、外部 CI 是否另行调用、或未来新增 tests 是否被 glob 正确收集。
