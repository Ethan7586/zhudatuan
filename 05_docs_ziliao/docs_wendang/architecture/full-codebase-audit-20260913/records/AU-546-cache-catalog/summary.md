# AU-546｜缓存策略权威目录

- 审阅范围：`02_platform_pingtai/config/cache.yml`（33 行）；定向阅读 runtime config generator、generated drift gate 和两份实际生成投影。
- 审阅方式：配置、生成/校验链与 output 人工核对；未运行 `--check`。

## 真实运行关系

cache catalog + capacity catalog → `build-runtime-config.mjs` validate → `RuntimeCatalog.generated.ts`（Node/runtime）及 Miniapp `CachePolicy.js` → `check:generated` 以 `--check` 逐字校验生成物。cache entry 定义 key shape、maximum TTL、允许 stale duration 和 command revalidation policy。

## 审计结论

- **G0**：六类 cache（experience/catalog/category/access/reporting/session）均有非空 key、正整数 TTL、`0 ≤ stale ≤ maximum` 与 boolean revalidate；generator 会拒绝无效 owner/version/name/field。
- 当前 TypeScript 与 Miniapp `CachePolicy` 投影与 YAML 的六项字段一致；直接手改生成物将在已配置的 drift gate 下失败。
- 缓存 TTL 对真实数据新鲜度、越权风险与 command invalidation 的语义，不能仅从 YAML 判断；相关消费者与既存 F-0032 由对应模块专项处理。

## 未验证项

- 未执行 generator check，未追踪所有 runtime cache consumer、cache key 实际绑定值、event invalidation 或生产 stale/read-after-write 行为。
