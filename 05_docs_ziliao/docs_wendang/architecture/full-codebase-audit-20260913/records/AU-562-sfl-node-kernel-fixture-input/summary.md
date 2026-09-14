# AU-562｜SFL 节点内核生成 fixture 输入

- 审阅范围：`02_platform_pingtai/config/sfl-node-manifest-fixture-input.json`（38 行）及 `sfl-node-kernel` generator/check。
- 审阅方式：fixture schema、生成/验证逻辑人工阅读；执行正式只读 `node --import tsx 04_tools/scripts/check/sfl-node-kernel.mjs`。

## 真实运行关系

fixture input → real SflNodeKernel generator → `sfl-node-manifests.generated.json` fixture artifact → deterministic byte equality/deserialize round-trip/digest/host resolution/cross-node isolation/tamper and ambiguity rejection assertions。它只产生 `.invalid` fixture hosts 与 placeholder release facts，不参与生产 node manifest 或 deployment。

## 审计结论

- **G0（测试/生成 fixture）**：四个 fixture nodes（一 L0、三 L1）覆盖 signed-level classification、独立 realm/scope/resource/secret/payment/callback/runtime/release refs、精确 host match与无 fallback。input 的 `012345…` source SHA、`aaaaaaaa…` artifact digest 明确为 fixture，而非实际 release facts。
- **定向验证通过**：generator/legal serialization、generated fixture drift、digest verification、host resolution、跨节点隔离、authority tamper、identifier/host ambiguity与invalid host rejection全部 PASS；SFL-17/18正确标记 UNKNOWN，因为没有生产 provisioning/artifact evidence。
- 该文件路径含 fixture，且 checker的唯一 consumer明确读取它；不得把其样例 source/digest 当作生产配置、凭据或删除依据。

## 未验证项

- 未审实际 `SflNodeKernel` 全部实现/真实 production manifests/provisioning；fixture pass不能证明资源已分配、线上 deployment已发生或生产域名正确。
