# AU-091｜Organization 层级读取与 WebBusiness 装配深审

Organization 唯一 operation 以已授权的 access.scope.id 查询 organization.unitclosure 后代，按 ID keyset 分页且每页最大 1,000。

全量 Commerce OrganizationModule 与 WebBusiness WebOrganizationModule 都复用同一 organizationOperations；Web selected module 仅公开 organization.layers.read，未形成第二套查询或权限路径。

结论：未发现 P0–P3 新问题。Vitest 未安装，静态 manifest test 未执行。
