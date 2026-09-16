# AU-789｜SFL 节点内核 fixture 门禁

- 审阅范围：`check/sfl-node-kernel.mjs`、fixture input/generated manifest 与 `SflNodeKernel` public generator/parser/resolver。
- 审阅方式：深读 fixture generation、serialization/digest、segment classification、host resolution、tamper/identifier/host ambiguity rejection、L0/L1 isolation和artifact provenance；执行默认只读模式，未传 `--write`。

## 审计结论

- **G0：保留。** 验证节点 manifest 内核的确定性生成、digest 完整性、精确 Host 解析、无默认 fallback、节点间 realm/scope/resource/runtime/release refs 分离。
- **验证结果：** 4个 fixture manifest 的所有内核断言通过；SFL-D03/D04为 PASS。
- **边界：** SFL-17/SFL-18明确为 UNKNOWN：输入使用固定占位 source SHA/artifact digest，未创建生产 resource binding 或实际发布制品。因此不能把 fixture 成功写成真实节点 provisioning/release 已完成。
