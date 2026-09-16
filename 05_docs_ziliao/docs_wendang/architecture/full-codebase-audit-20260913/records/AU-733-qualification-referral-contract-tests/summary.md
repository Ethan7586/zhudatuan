# AU-733｜资格治理与推荐数据库合同测试

- 审阅范围：qualification governance 与 referral foundation 的 2 份 SQL 合同。
- 审阅方式：深入审阅双人审批、版本 stale、历史回滚快照、外部资格来源保护，以及推荐绑定、佣金/反向分录、追回与提现约束；未运行 SQL。

## 审计结论

- **G0：全部保留。** qualification contract 是权限治理变更的业务规格；referral contract 保存推荐结算生命周期与资金回退的一致性约束，二者不可互换。
- 资格合同拒绝申请人自审和覆盖 HR 外部标签；推荐合同以动态 scope/成员/订单造数来验证绑定、佣金、反向与恢复数据的关联约束。均由 `begin`/`rollback` 隔离。
- 未发现新增问题。运行器与当前 migration head 的实际兼容性未验证。
