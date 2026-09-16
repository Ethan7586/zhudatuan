# AU-824｜发布 Cutover 证据验证器

- 审阅范围：`04_tools/scripts/release/cutover.mjs`（36 行）与发布检查中的静态调用关系。
- 结论：该文件不执行切流；它验证 release/evidence schema、release ID/commit、原始 release bytes 的 SHA-256、1 小时有效期、5→25→50→100 流量台阶、8 个带哈希的通过项，以及需求/对账/库存/重复副作用/会计/范围零差异。
- 验证：以内存 release 和 evidence 成功通过正常路径；将时间设为超过一小时后得到 `CUTOVER_EVIDENCE_STALE`。未读取或写入发布制品，未联机、部署或切流。
- 风险判断：这是发布控制面的纯门禁而非垃圾或运行时部署器，归 **G0**。实际 evidence 产出者、生产切流执行器和线上回滚仍由后续发布运行单元审计。
