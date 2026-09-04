# 旧层级数据兼容迁移方案

## 原则

采用 expand → backfill → dual-read → verify → contract。当前阶段只完成前四步，禁止直接删除旧字段。

## 阶段

### 1. Expand

- 新增组织节点和闭包表。
- 新增只读的组织路径 RPC。
- 给组织表启用 RLS，匿名与普通认证用户不可直接读取。

### 2. Backfill

- 创建唯一平台根。
- 每个 tenant 建立安全租户节点。
- enterprise 挂在对应安全 tenant；将来引入 distributor 时只移动 tenant 节点，集团及全部后代不需要逐个重挂。
- mall 和 department 依据旧外键挂在 enterprise 下。
- 部门子树保留原 `parent_id`。

### 3. Dual-read

- 资源仍从旧表加载 tenant/enterprise/mall/department 快照。
- 服务端可额外取得数据库派生的 `orgUnitPath`。
- 判定引擎优先匹配祖先路径，缺失时继续使用旧平铺字段。

### 4. Verify

- 每个旧实体必须恰好映射一个组织节点。
- 每个非平台节点必须有自身闭包记录和平台祖先。
- enterprise/mall/department 的安全 tenant 与旧外键一致。
- 任意 enterprise、mall、department 授权不能跨 tenant。

### 5. Contract（本期不做）

只有生产观察期、回滚演练和历史数据核对全部通过后，才讨论收敛旧字段或旧匹配分支。

## 回滚

新判定是兼容增量。应用可停止传递 `orgUnitPath` 并立即回到原平铺判定；旧业务字段、表和 API 均保持不变。数据库新增表可以保留，不影响旧运行路径。
