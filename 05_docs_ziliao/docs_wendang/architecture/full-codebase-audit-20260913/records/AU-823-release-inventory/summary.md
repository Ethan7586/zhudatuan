# AU-823｜发布制品校验清单

- 审阅范围：`04_tools/scripts/release/inventory.mjs`（13 行）及其唯一内部依赖 `artifacts.mjs` 的目录遍历/散列行为。
- 结论：必须提供目标目录且拒绝根目录；以稳定字典序遍历普通文件、计算 SHA-256，并写入 `checksums.sha256`。既有清单和 `release.sigstore.json` 被排除，避免自身递归及将签名纳入错误的前置清单。
- 调用证据：未发现仓内 package/workflow/source 的静态注册；这不能证明闲置，仍可能由人工发布或外部 CI 编排调用。
- 验证：未执行。该脚本写入发布目录，运行会改变制品；应仅在隔离制品目录由发布专项审计复核。归为 **GX**，无新增产品缺陷。
