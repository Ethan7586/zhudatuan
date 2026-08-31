# MVP 融合工作区基线

记录时间：2026-08-30（Asia/Shanghai）

## 唯一生产主线

- 工作区：`/Users/changshengwang/Workspace/zhudatuan`
- 分支：`architectural-optimization`
- 提交：`13781f10e8f98e9d1ecf8d543c88398c1de5c108`

## 迁移来源

- 工作区：`/Users/changshengwang/Workspace/zhudatuan-li`
- 提交：`01f1ed49dd5df67d28956a116de066f5fa1d5668`
- 关系：来源提交是主线提交祖先，融合采用语义迁移，禁止机械合并。

## 权威输入

- `docs/福利商城功能清单.xlsx`：`929adc27d86deca640af17329cd9413b4e8dd5b850f1c596de98f1d1272d7750`
- `docs/architecture/完整MVP架构方案.md`：`498dc204938e86e8385f61b56cb0ac3c4f835cbd5b12518f887732d2aed1c199`
- `docs/architecture/完整MVP架构方案修改点清单.md`：`daee3147ac07d83c892886c8207697e846d8942f79ab398022c06c46888303c6`

## 既有工作区状态

- 修改：711
- 删除：998
- 未跟踪：342
- 合计：2051

上述 2051 项在无法进一步确认作者归属前全部按用户已有工作处理。实施过程不得执行硬重置、批量 checkout、覆盖式目录复制或以旧线目录替换主线目录。

## 文件处置规则

| 来源                            | 默认处置     | 约束                           |
| ------------------------------- | ------------ | ------------------------------ |
| 主线现有已修改文件              | Preserve     | 仅做目标修改所需的最小补丁     |
| 主线现有未跟踪文件              | Preserve     | 先读取再决定是否纳入正式实现   |
| LI UI 与交互文件                | Refactor     | 迁入主线应用并改接唯一 SDK     |
| LI Referral 与 Finance 算法     | Refactor     | 保留领域语义，重建模块边界     |
| LI 旧 API、兼容路由、兼容数据库 | Delete       | 不复制到主线                   |
| LI Mock、Showcase、Demo、设备壳 | EvidenceOnly | 只作为视觉参考，不进入生产路径 |
| 主线历史数据库迁移              | Preserve     | 永不重写或重新编号             |
| Contract、SDK、导航、权限生成物 | Regenerate   | 只由唯一生成器生成             |

## 禁止覆盖路径

- `database/migrations`
- `packages/contract/definitions`
- `services/commerce/src/foundation`
- `services/commerce/src/modules/identity`
- `services/commerce/src/modules/access`
- `apps/auth/src`
- 当前 Git 状态中所有用户已有修改，除非本次变更逐文件读取并实施最小补丁。
