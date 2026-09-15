# AU-864｜卡券调用与数据流审阅

- 审阅日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`voucher/Flows.md`，1 个文件、922 行。
- 方法：审阅 HTTP 流水线、发行、核销、退款、作业失败恢复和模块数据流表；与实际 jobs 注册、Voucher operations、job processor、deadletter/outbox 及冻结 Target Contract 对照。客户/产品/审批的重复目标细节仅做边界核验。

## 结论

文档所述 `voucherissue`、`voucherstatus`、`voucherexpiry` 和 `voucherimport` 均有当前 manifest 与 `app/jobs.ts` 注册；发行 job 也确有 chunk、KMS、财务事实和 `voucher.issued` outbox 处理。该对应关系只证明运行作业骨架存在，不证明整份目标流程已上线。

实体/电子订单、B2B 备券审批、稳定 IssueItem、部分退款、搜索投影和导出等流程属于 74 个冻结 target operation 所依赖的目标模型。当前 runtime 的 `voucher.redemptions.reverse` 为单个已核销记录的完整逆转入口；它不应被误读为已经实现文档目标的任意部分退款协议。目标/现行差异已由 AU-861 至 AU-863 的边界结论保留，未发现本文件把它们标成当前生产事实。

没有新增 finding。文件归 G1：保存命令、作业、失败/重试和一致性设计的唯一流程规格；在 Target Contract 启用及交付验证完成前，不得据此改造、删除或宣称现有运行行为。

未执行测试、构建、部署、数据库写入或外部控制面操作，未修改业务代码、配置、测试、工作流、迁移或运行资源。
