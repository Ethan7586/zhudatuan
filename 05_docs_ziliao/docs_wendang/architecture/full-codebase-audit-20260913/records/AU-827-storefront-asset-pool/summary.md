# AU-827｜Storefront 跨版本资产池

- 审阅范围：`04_tools/scripts/release/storefront-assets.mjs`（203 行）与既有 recovery test（AU-757）。
- 职责：把多版本 Storefront 内容哈希资产放入共享对象池，以原子 hard link 回填各 release root，维护 `manifest.json`，使切换和回滚仍可读取旧/新 JS 资产。
- 保留设计：锁、hash 校验、冲突拒绝、symlink 拒绝、原子临时文件和跨文件系统拒绝均为实际制品完整性控制；不能按无仓内自动调用视为闲置，归 **GX/DC-0096**。
- 新发现：**F-0319/P2**。pool 与 asset roots 不做拓扑不重叠验证；重叠输入会让刚创建的 `.merge.lock`、objects 或 manifest 落入资产扫描。未执行该写入器或破坏性反例；既有测试仅验证互不重叠的临时目录、A/B 回滚和文件名冲突。
