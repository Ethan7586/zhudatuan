# Canonical Source Manifest

记录时间：2026-09-04T15:41:29+08:00

## 唯一生产主线

| 项目 | 值 |
| --- | --- |
| 工作区 | `zhudatuan` |
| 分支 | `backend-reconstruction` |
| 基线提交 | `5fb180fb74dd36243cf7179b413ff4e44ad18a86` |
| 已跟踪文件 | 4,748 |
| 基线工作区状态 Hash | `045fc48b40c83590f80c29021dd05188ea4d8a1f3a93f5ebda787cd967f041d7` |
| 融合来源 | `zhudatuan_li` |
| 来源分支 | `codex/l1-consumer-qr-multi-registration-20260903` |
| 来源提交 | `b763b7a12c9aa825c532a35c3cce06da4455ed98` |
| 来源工作区状态 Hash | `07251fbcc35e3841e60434d3f6d3342372c6898386c453fcdd3373bbe01cf7d2` |

`zhudatuan_li` 仅是语义和视觉迁移来源，不参与主线 Build、Test、Runtime 或 Deploy。融合采用逐能力重构，不做 Git 历史机械合并，不复制来源 Runtime、数据库迁移、兼容 API、Mock、Demo、Showcase 或 Sample。

## 权威输入

| 权威材料 | SHA-256 | 用途 |
| --- | --- | --- |
| `docs/福利商城功能清单.xlsx` | `48b2a8ea94b9b20d2599772d8fe1871637f48dbbbc3408e09e0ea8a1822e7436` | 22 条 MVP 与一期接口唯一需求源 |
| `docs/architecture/福利商城理想方案20260904.md` | `8929aa3435d4c842405aecd4c6baf46163b25aa0bac6b798de8f44842bc67ec9` | 目标架构、数据流、UX、一致性与验收原则 |
| `docs/architecture/福利商城代码修改清单20260904.md` | `968d249a8ebee43c9d580e228f1d8071052154b2ee21761c1134f45dc845f1ff` | 逐文件实施顺序与删除条件 |
| `zhudatuan_li/docs/当前代码业务功能清单-20260904.md` | `bc1e7d0730b21ea97d2561fad82341feac4113179f53c26e8e641c8ff25c9b94` | 必须保留的来源功能语义 |
| `zhudatuan_li/docs/zhudatuan-console-UX-acceptance-report-20260904.md` | `66bcec351b605c043744f817d557f25ecea9a0c45165d89c897760c73463a266` | UI/UX 缺陷与视觉验收基线 |

冲突顺序固定为：工作簿 MVP → 当前真实业务功能 → 理想方案裁决 → 代码修改清单路径建议 → 可证明的主线代码事实。路径可以在实现中因现有结构微调，领域所有权、不变量、功能语义和验收结果不得降低。

## 当前生产入口

| Surface/Process | 唯一入口 | 当前状态 | 目标处理 |
| --- | --- | --- | --- |
| Auth | `apps/auth/src/main.tsx` | 保留 | 融合 LI 登录视觉与完整身份流程 |
| Console | `apps/console/src/main.tsx` | 保留 | 融合 LI Console UI/UX，补齐真实动作 |
| Storefront | `apps/storefront/src/main.tsx` | 保留 | 融合 LI 多端体验，删除 Mock/Showcase |
| Miniapp | 尚不存在 | 待新增 | 从 LI 资产、环境、缓存和 Deep Link 语义重建 |
| Store | 尚不存在 | 待新增 | 门店接单、履约、退货、核验和库存工作台 |
| Supplier | 尚不存在 | 待新增 | 供应商商品、库存、订单、履约和财务工作台 |
| API | `services/commerce/src/app/ApiMain.ts` | 保留后移动 | 目标 `entry/ApiMain.ts` |
| Jobs | `services/commerce/src/app/JobsMain.ts` | 保留后移动 | 目标 `entry/JobsMain.ts` |
| Provider | `services/commerce/src/app/ProviderMain.ts` | 保留后移动 | 目标 `entry/ProviderMain.ts` |
| Migration | `services/commerce/src/app/MigrationMain.ts` | 保留后移动 | 目标 `entry/MigrationMain.ts` |
| Smoke | `services/commerce/src/app/SmokeMain.ts` | 发布验证专用 | 目标 `entry/SmokeMain.ts`，禁止造业务数据 |

## 当前事实计数

| 事实 | 数量 | 唯一来源 |
| --- | ---: | --- |
| Commerce 模块 | 32 | `services/commerce/src/modules/*/Manifest.ts` |
| Operation | 276 | `packages/contract/definitions/operations.yml` |
| Integration Event | 103 | `packages/contract/definitions/events.yml` |
| Navigation Route | 53 | `config/navigation.yml` |
| Navigation Node | 63 | `config/navigation.yml` |
| 产品客户端 | 3 | `package.json#workspaces` |
| 一期渠道业务扩展 | 11 | `config/providers.yml` 与 Extension Manifest |
| 历史数据库迁移 | 316 | `database/migrations` |
| MVP 行 | 22 | `MVP上线功能清单!A3:F24` |

LI 合同有 328 条 Operation。与主线共有 231 条，LI 独有 97 条，主线独有 45 条。97 条 LI 差异必须逐条标记保留、重命名或替换；不能静默删除。

## 唯一事实源

| 事实 | 唯一源 |
| --- | --- |
| Requirement/MVP | `docs/福利商城功能清单.xlsx`，由 Requirement Generator 读取固定 Hash |
| Operation/Event/Error/Permission/Capability | `packages/contract/definitions` |
| Route/Navigation | `config/navigation.yml` + Feature Manifest |
| Provider | `config/providers.yml` + 签名 Extension Manifest |
| Runtime Config | `config/*.yml` + `packages/config` |
| UI Token | `packages/design/src/tokens.json` |
| 中文状态与错误 | `packages/presentation` |
| Module/Public Port | Commerce Module Manifest 与 `public` |
| 数据所有权 | `database/contracts`、迁移与数据库权限 |
| 发布资格 | `evidence/releases/index.json` 及签名 Release Evidence |

## 来源 UI 与功能迁移范围

| LI 来源 | 主线目标 | 处理规则 |
| --- | --- | --- |
| Console Shell、Header、Sidebar | Console Shell + Design Template | 保留信息层级与视觉，禁止第二套 Shell |
| Product、Order、Finance 工作台 | 对应主线 Feature | 保留 UI/UX，改接生成 SDK 和真实 Operation |
| Access、Owner Transfer | `settings/access` + Access 模块 | 保留低认知负荷流程，使用主线 Proof/Scope |
| Application、Mall Create、三套设计 | Experience Wizard/Designer | 三主题共用一个实现，不保留 Provisioning 模块 |
| Voucher 新版合同和页面 | Rich Voucher + Approval + Partner Customer | 保留全部 57 条新语义，硬切旧 19 条模型 |
| Storefront 多设备 UI | Storefront responsive patterns | 保留视觉与功能，删除按设备复制的业务实现 |
| Miniapp 资产/配置/Deep Link | 新 `apps/miniapp` | 转为正式构建并接唯一 SDK |
| Mock、Demo、Showcase、Preview Runtime | 不进入生产 | 仅作视觉证据，替代能力通过后删除 |

### Console Shell 来源文件核对

以下文件只存在于相邻的只读迁移来源仓 `zhudatuan_li`，主线没有复制品，也没有构建、测试、运行或部署依赖。主线只承接信息层级、视觉密度、折叠/移动端行为和键盘交互；导航、任务、通知、范围、身份和二次验证数据均改由主线 Bootstrap、Navigation、Session 与 Task Port 提供。

| LI 来源文件 | SHA-256 | 主线唯一目标 | 已承接行为 | 主线处理结果 |
| --- | --- | --- | --- | --- |
| `apps/console/src/components/Header.tsx` | `584ee9ff0484eafaf4253c7960b0e56eb49ec85d2055162955d872d5acd75df0` | `apps/console/src/shell/Header.tsx` | 面包屑、命令搜索、任务、通知、帮助、账号、安全等级、移动导航 | 未复制来源文件；删除假任务/假通知，全部按钮连接真实数据或路由 |
| `apps/console/src/components/Sidebar.tsx` | `f2fbd8c1ed55d064cbc547d757e528e8265d29f9a0d3fa86d522637177a24c7c` | `apps/console/src/shell/NavigationTree.tsx` | 品牌区、展开/收起、分组层级、当前项、成员摘要、窄屏标题 | 未复制来源文件；删除硬编码菜单和本地可见性判断，唯一输入为服务端导航树 |
| `apps/console/src/shell.css` | `bca1a95ccc1db466e4100cd8570bd11cf12d998a964c46248d46ab70544c7d7d` | `apps/console/src/shell/Header.css`、`Navigation.css`、`style/Layout.css`、`Profile.css`、`Scope.css`、`packages/design/src/shell.css` | 侧栏/顶栏比例、工作台留白、遮罩、折叠与移动端布局 | 按组合职责拆分；未整文件复制，不形成第二套 Shell |
| `apps/console/src/feature.css` | `3fb1fe18872365b6acb83cb7873efbbdc5c5369475eb0e677420851dc0c3f1a4` | `packages/design/src/tokens.json`、Design Pattern、各 Feature Owner 样式 | 卡片、筛选、表格、详情和状态的共同视觉语义 | 按 Owner 迁移；主线不存在大而全 `feature.css` |
| `apps/console/src/responsive.css` | `20ea70c6b4c77d66e534e0c2ff0913ff0c356cc16a320589bca531469ee81552` | Design Token 四断点、Shell 与 Feature 响应式文件 | 1024/768/375 等宽度下的导航、表格、抽屉和操作区重排 | 按组件就近迁移；主线不存在全局 `responsive.css` 覆盖层 |

来源视觉截图只用于迁移比对，不进入运行制品：

| 来源截图 | SHA-256 | 用途 |
| --- | --- | --- |
| `docs/evidence/vi/2026-08-28/zhudatuan-vi-1.1-desktop.png` | `ade77f65154fa217219206e7adfadbf2243a491cc6d27fbadcd3d9bda96cbee9` | 桌面 Shell、卡片密度、品牌和工作台层级基线 |
| `docs/evidence/vi/2026-08-28/zhudatuan-vi-1.1-mobile.png` | `de9dbad55322a1593cb01c7689ccfe032cf088d12d31458a67978d71902fdc6a` | 移动导航、触控密度与响应式基线 |
| `docs/brand/design-previews/zhudatuan-design-system-vi-1.1.png` | `b1482d7957888a4df36f013035822f8e2c474afe9bed9f9e36bb714760a81013` | Token、控件和状态语义基线 |

按代码清单 16.4 的删除边界，本次只确认主线重复实现为零；不物理删除独立来源仓。来源仓是否归档或删除属于单独的仓库治理操作。

### Legacy 主题输入核对

| LI 迁移输入 | SHA-256 | 主线唯一事实源 | 主线处理结果 |
| --- | --- | --- | --- |
| `apps/console/src/legacy-admin-theme.css` | `f0bfb703f25ecc6d5411a6fc8617da597fa2ab2e717cbc0e1ecb76ef368d3084` | `packages/design/src/tokens.json`、分层 Design/Shell/Feature 样式 | 主线无文件、无导入、无覆盖层；视觉值已转为 Token 或组件 Owner 样式 |
| `apps/console/src/smart-wing-vi.css` | `b0a2a8e9ef65677d5bb10f75c6a90be5a8cb63a62b0f6422298d74a1f9d278c9` | `packages/design/src/tokens.json`、由 Token 生成的 Web/Miniapp/原生端常量 | 主线无文件、无导入、无覆盖层；智慧翼色彩、字体、圆角、阴影、动效和断点由生成链唯一输出 |

上述 CSS 保留在独立来源仓中仅供追溯，不参与主线制品。主线质量门校验 Token 版本、品牌色、夜空色、表面色、正文色、四断点、44px 触控目标、120/200/320ms 动效和减少动效策略，防止旧主题覆盖层回流。

## 保护与排除

- 保留用户已有修改；当前两份 architecture 文档在基线时为未跟踪文件，视为用户提供的权威输入。
- 历史迁移只读；所有数据库变化追加新迁移。
- 不使用第二数据库、第二合同、第二导航、第二权限目录、双写、代理兼容路由或长期 Feature Flag。
- `node_modules`、`dist`、缓存、`.env.local`、私钥、Secret、支付证书不属于源码制品。
- 生产构建拒绝 Mock、Fallback、Simulation、Showcase、Demo、Sample、ComingSoon 和占位动作。
- 机器可读制品由 `config/artifacts.json`、生成器、Release Candidate Facts 和签名 Release Manifest 共同约束，人工清单不得替代运行证据。
