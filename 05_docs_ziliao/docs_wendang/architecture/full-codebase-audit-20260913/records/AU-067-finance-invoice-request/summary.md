# AU-067｜finance 发票申请、审批、红冲与查询深审

- 本单元覆盖发票请求的 create/cancel/decide/red 命令，以及 member/operator profile 和 request/document 读取。
- create/cancel/decide/red 将组织、profile、settlement、金额、行、状态/version 和红冲资格交给受管 invoice 数据库过程；应用层校验 body、调用 access、批准时以稳定 job:invoice:<request> 入队。读取分别以 membership、operator scope 或 profile owner 限定。
- 当前测试只模拟 create 的成功与数据库过程拒绝，未覆盖 cancel、approve/reject 入队、red、读取隔离/分页或数据库过程实际约束。新增 F-0154/P2。固定审计 worktree 无 vitest 可执行文件，未安装依赖；未发现 P0/P1。
