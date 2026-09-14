# AU-468｜Membership scope 规范化

- 主审 `20260821061000_normalize_membership_scopes.sql`（67 行），并人工反查 scopegrant、scope object/resolver 与 session context consumer；未执行迁移或线上查询。
- 迁移将历史 grant 校正为可解析的 self、owner 或组织节点，补齐 active member 的 self 和 storefront member 的 owner allow，保留 access version，并清除同 key 的重复行。
- 最终断言每项 scope 的解析 kind 与记录 kind 一致且不存在重复，防止错误 scope ID 被静默授权。
- **G0**：当前 access scope 机制依赖这些数据。**GX-0027**：身份授权数据迁移，禁止删除、改写或单独重放。未发现新增 P0–P3；未验证全量 scope 数据、RLS 和恢复演练。
