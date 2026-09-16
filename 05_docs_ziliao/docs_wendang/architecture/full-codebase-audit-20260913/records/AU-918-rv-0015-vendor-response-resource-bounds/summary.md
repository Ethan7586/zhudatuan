# RV-0015｜Vendor 响应资源边界独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。从共享 VendorClient → vendor consumers → response parsing/retry 重新取证；未请求 provider 或制造大响应。

1. `vendors/core/Client.ts:68-129` 调用 `response.text()` 后 JSON.parse，再以递归 `isJsonObject/isJsonValue` 遍历任意深度数组/对象；没有 Content-Length、streaming byte、节点数或深度上限。
2. deadline/AbortController 只限制连接/响应时间，不能阻止一个在限时内发送的巨大或深层合法 JSON 在内存中完整分配和递归遍历。
3. jd/tmall/wenxuan/wanlian 等 runtime clients 直接构造共享 VendorClient；Cakeuncle 另有 2 MiB `readLimited`，但它是局部实现且仍无 JSON depth/node budget，不能保护共享 consumers。

**F-0097 确认 P1，高置信度。** 已认证外部 provider 可通过大或深层响应触发单次请求高内存/栈耗尽，影响共用 Commerce 运行单元；写请求还可能在远端完成后本地解析失败，引入重试不确定性。未证明线上 provider 正在攻击、进程发生 OOM 或数据已错误，故不是 P0。

修复须在最新主线的单一 transport 批次中建立共享 streaming byte、JSON depth/node 限额与稳定错误码，并按 read/write/idempotency 重试验证；Cakeuncle 的兼容策略另行裁决。
