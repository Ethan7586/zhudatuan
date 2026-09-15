# AU-821｜工具 TypeScript 编译配置

- 审阅范围：`04_tools/tools/requirementgen/tsconfig.json` 与 `04_tools/tools/seed/tsconfig.json`；它们共享根 `tsconfig.json` 的严格、无输出编译基线。
- 代表性深审：RequirementGen 的配置只收窄至 ES2022/Node 与 `src/**/*.ts`，不自行放宽根规则。Seed 在相同基础上增加 DOM/DOM.Iterable；抽样调用证实其用于 `fetch` 与 `AbortSignal` 的密钥存储 HTTP 访问，而不是网页运行时泄漏。
- 逐文件差异核对：两份配置均只定义 library/types/include，均无 emit、路径别名或项目引用覆盖；无配置漂移、无额外运行入口，也没有代码生成职责。
- 验证：两项正式 workspace `typecheck` 都因环境缺少 `@types/node`（TS2688）在项目检查前失败。未安装依赖、未改配置；结论标记为类型检查未验证，不把环境失败归为产品缺陷。
