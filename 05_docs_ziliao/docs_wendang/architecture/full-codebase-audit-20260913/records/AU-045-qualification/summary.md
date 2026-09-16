# AU-045｜qualification 资格策略完整链深审

## 范围与真实运行链

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- Console 的 `settings/qualification` 由 manifest 懒加载 `QualificationRoute`，以 cursor + `PagedResource` 调用 `qualification.center.read`；该只读页不暴露策略写入。
- 服务端 `BUSINESS_MODULES` 注册完整 `QualificationModule`，因此三个已生成、公开承诺的操作均存在运行时入口：读取、决策预览、策略管理；Identity Operator 的选定模块只暴露读取操作。
- checkout 的 `QuoteReader` 是资格策略的实际业务消费者：它读取 `policyversion.rule`、`resource`、`subject` 和 `purchaselimit`，在报价中决定每个商品行是否可接受。

## 数据与边界

- `qualification.policy` 的当前状态由 `active_version` 指向；版本正文在 `qualification.policyversion`，资源、主体和购买限额是独立的版本化子表。
- `qualification.policies.manage` 只写 `policy` 与 `policyversion`，并立即置为 `published`；接口请求/响应 schema 是开放对象，未承诺资源、主体或限额字段。
- 无直接 Console 调用 `qualification.decisions.preview` / `qualification.policies.manage` 的证据；但二者已生成 SDK、OpenAPI 和 runtime 路由，属于对外运行契约（G0），不能按“零页面引用”判为无用。

## 发现

- [P1 候选][F-0138] 策略管理写入不读取 `If-Match` 所传的版本条件，两个不同幂等键的并发请求会顺序生成新版本并以后者覆盖 active version；需要独立复核调用链与写入语义。
- [P2][F-0139] 决策预览只检查 profile 状态与资源排除，未执行 checkout 使用的 rule、tag、城市和购买限额判断，预览与实际结算可能得出相反结果。
- [P2][F-0140] 公开管理 API 不能写入 checkout 真正使用的资源/主体/购买限额版本子表，却会立即发布策略；该 API 不能表达受资源范围或购买限额约束的策略变更。

## 验证状态

- 识别的正式入口为 Console/Commerce 的 `vitest run --config vitest.config.ts` 与 `tsc --noEmit`；固定审计工作树缺少两处包级 `vitest/tsc` 可执行文件，未安装依赖，故未运行。
- 仅完成静态与逐逻辑阅读；未连接数据库、未访问线上、未修改业务代码、迁移、配置或生成物。
- 未发现 P0 级正在发生事故证据。
