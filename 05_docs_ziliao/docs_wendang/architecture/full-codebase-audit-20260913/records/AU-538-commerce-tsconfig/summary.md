# AU-538｜Commerce TypeScript 编译边界

- 审阅范围：`01_core_hexin/services/commerce/tsconfig.json`（8 行）；定向核对根 TypeScript 严格性配置、commerce package scripts 和正式 release control-plane typecheck entries。
- 审阅方式：配置与运行/发布入口人工阅读；未运行 typecheck。

## 真实运行关系

release target quality gate → `npm run typecheck --workspace @shop/commerce` → `tsc --noEmit` → commerce `tsconfig.json` → 根严格 TypeScript options；project 包含 commerce `src`、`tests` 和三类 Vitest config，而不产生运行制品。

## 审计结论

- **G0**：这是 commerce 的正式编译质量边界；release manifest 多个 commerce deployment target 均直接调用 workspace typecheck。它继承 root 的 strict、unchecked index、exact optional、unknown catch、isolated modules/noEmit 等约束。
- `DOM` 与 Cloudflare Worker types 同时纳入，匹配同一服务中 HTTP/Worker adapter 的编译需求；没有发现本文件承担生产启动、部署指针或生成制品职责。

## 未验证项

- 未执行 typecheck，无法确认当前基线编译是否通过、真实 CI 是否完整执行所有 release manifest quality gates，或 type declaration collision 是否存在。
