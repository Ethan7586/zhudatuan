# RV-0052｜Invitation resource scope resolver 演进独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0030
- 结论：**维持 GX；未发现 P0。**

邀请迁移为 create/revoke 解析组织 scope，Experience 迁移将 immutable version 回查 owning application；未知资源显式失败且函数仅授予 shopapp。后续会话 scope 解析、Web runtime 就绪检查仍要求该函数族。多次 function replacement 是授权演进的顺序依赖，不可删除或单独重放；真实函数定义、grant、跨组织反事实与恢复未验证。
