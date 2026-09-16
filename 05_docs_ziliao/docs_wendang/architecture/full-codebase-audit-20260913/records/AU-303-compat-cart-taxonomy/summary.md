# AU-303｜Compatibility 购物车分类投影

该迁移只重定义既有 `api_cart_snapshot_qualified`，在原有购物车项中加入 `products` 真相表的 `categoryCode` 及三级 taxonomy；它不引入新表、写入路径、权限或客户端自行计算的商品分类。RPC 仍按 tenant、mall、用户范围取购物车，并逐项调用既有商品资格判定；调用入口仍是 `commerce-api` 的 service-role 购物车路由。

`cartRoutes.test.ts` 覆盖该投影经路由返回而不由 API 层拼造商品字段，但没有对新增 taxonomy 字段做独立断言。这是后续契约测试可补充的非阻塞观察项，当前没有证据证明字段缺失或调用方已受影响。

未发现新增 P0–P3 问题。因审计工作树缺少 Vitest 依赖，未执行相关测试；结论基于迁移、路由和测试代码的静态调用链取证。
