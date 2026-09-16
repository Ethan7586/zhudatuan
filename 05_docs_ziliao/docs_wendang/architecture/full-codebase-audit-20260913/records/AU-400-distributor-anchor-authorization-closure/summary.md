# AU-400｜分销锚点授权闭环

`20260820121500_distributor_anchor_authorization_closure.sql` 用 `api_lock_membership_actor` 锁定成员、用户、范围、分销商和租户关系，再将会员管理、角色、资质、step-up、券身份、会话创建和登录身份列表重包为唯一 service-role 入口。原实现被改名为 `internal_anchor_*` 且撤销 service-role 权限；公开包装器再核验相应动作权限。

Commerce API 直接调用其中的会话和权限命令入口。`distributor_anchor_authorization_closure_contract.sql` 覆盖活动锚点、关系过期后的读写拒绝、无副作用、全部写入口 lock gate 以及内部 primitive ACL。该迁移为 G0：分销关系失效会使会话与业务授权同步 fail-closed，不是删除候选。

未发现新增 P0–P3；未执行测试、数据库写入、构建或线上检查。
