# 智慧翼 VI 收敛执行计划

版本：1.0　日期：2026-08-14　Owner：Ethan
执行方：Codex（或任何接手的 session）

---

## 0. 这份文件是什么

两份独立评估都得出同一个方向：**主 Shop（`apps/storefront-web`）偏离统一 VI，微信小程序更接近 VI**。本文件把结论转成可执行任务，并给出每一项的验收标准。

**执行前必须先读：**

1. `docs/brand/SMART-WING-UNIFIED-VI-1.0.md` —— VI 硬规则
2. `docs/SMART-WING-MALL-MASTER-CHARTER.md` —— 商城总纲与冻结决议
3. `apps/wechat-miniapp/00-新任务从这里开始/10-小程序开发完全说明.md` —— 资产管道怎么工作
4. `apps/wechat-miniapp/00-新任务从这里开始/09-已确认决议记录.md` —— Ethan 已拍板的事

**核心原则：先装机制，再做清理。** 没有守门人的批量替换会在几周内回潮 —— 小程序已经因此失败过两次。

---

## 1. 实测基线

以下数字均在 2026-08-14 复核通过，可作为执行前的基线。复核命令见第 7 节。

### 1.1 `apps/storefront-web/src`

| 项目                            |                                            实测 | VI 规定                                   |
| ------------------------------- | ----------------------------------------------: | ----------------------------------------- |
| 硬编码 hex                      |                                      **166 处** | 应为 0，一律 `var(--sw-*)`                |
| `var(--sw-*)` 使用              |                                          509 处 | ——                                        |
| `#FF7A00`（橙）                 |                           **54 处 / 24 个文件** | 不在 VI 调色板内                          |
| `#E5484D`（红）                 |                                       **53 处** | 不在 VI 调色板内（VI 风险色是 `#DC2626`） |
| 字号 < 12px                     | **435 处**（10px×227、11px×142、9px×65、8px×1） | 字号阶梯下限 12px                         |
| `font-black` / `font-extrabold` |                                      **199 处** | 字重上限 700                              |

Tailwind 色系使用次数：

```
gray 1610 · blue 414 · amber 143 · emerald 115 · yellow 71 · red 68
orange 62 · purple 30 · green 25 · indigo 21 · slate 12 · cyan 12 · rose 10 · teal 7 · pink 3
```

- 合规：gray/slate（中性）、blue（品牌）、amber/emerald/red（对应 VI 警示/成功/风险）
- **近义重复 158 次**：yellow 71 + orange 62 + green 25，与 amber/emerald 语义撞车
- **完全越界 83 次**：purple/indigo/cyan/rose/teal/pink，无 VI 依据

### 1.2 令牌分叉（已定位到单一原因）

| 文件                                         | `shadow-card`                              | 是否忠实于 `tokens.json`  |
| -------------------------------------------- | ------------------------------------------ | ------------------------- |
| `packages/design-system/src/tokens.json`     | `elevation.card` = x0 / y1 / blur4 / α0.04 | 母版                      |
| `apps/wechat-miniapp/.../styles/tokens.wxss` | `0 2rpx 8rpx rgba(7,24,47,0.04)`           | ✅ 换算等价（1pt = 2rpx） |
| `packages/design-system/src/tokens.css`      | `0 1px 2px 6% + 0 6px 18px 5%` 双层        | ❌ 偏离                   |

`overlay` 分歧更大：`tokens.json` 是 **y = −2px（向上）**，`tokens.css` 是 **y = 16px（向下）**，透明度翻倍。

**根因已确认：`packages/design-system/src/tokens.css` 是手写文件**，没有 `GENERATED` 头，`scripts/build-brand-assets.mjs` 也不生成它。它从未接入任何管道，因此必然与 `tokens.json` 漂移。

### 1.3 关于「同源度」这个指标

一份评估给出「同源度 36/100」，其中导航结构 2/10、字号阶梯 2/10。

**执行时不要以同源度为目标。** 当一端已知违反规范时，「两端有多像」只是换个方式再测一遍那一端的违规。Web 底栏中心是购物车，这不是"与小程序不一致"，而是**违反冻结决议第 8 条**；Web 435 处小字号是 Web 的缺陷，不是对称性问题。

**有用的指标是各端与 VI 的距离**：主 Shop 52 / 小程序 86。把 Web 修到规范，同源度会自己上升。

### 1.4 小程序的真实状态（纠正一处常见误判）

小程序不是"因为缺图而显得半成品"，而是**按计划只建了首页**：

```
pages/home/home.wxml        218 行   ✅ 已建成
pages/category/             16 行    ⬜ 阶段 4
pages/membercode/           16 行    ⬜ 阶段 3
pages/orders/               16 行    ⬜ 阶段 5
pages/profile/              16 行    ⬜ 阶段 5
```

**这四个空页是 `04-开发顺序与停顿点.md` 明确要求的分阶段停顿点，不是缺陷。** 任何"小程序完成度低"的结论都必须区分「VI 合规度 86」和「页面覆盖 20%」这两件事。

已有微信开发者工具真实截图验证：62 个图标全部渲染、底栏五栏正确、中央会员码白圆上浮、令牌全部接通、零编译错误。

---

## 2. 禁止事项

```
禁止 git clean / git reset --hard / git checkout --
禁止手改任何带 /* GENERATED */ 头的文件 —— 改生成器
禁止修改 tokens.json 的数值 —— 它是母版，只改派生物
禁止一次性批量替换 435 处字号或 199 处字重（见 T2 的 baseline 机制）
禁止在橙红裁决（D1）之前改动 #FF7A00 / #E5484D
禁止把小程序的 4 个占位页当作缺陷去"补齐"
禁止在没有 npm run check:vi 通过的情况下提交
```

---

## 3. 工具任务（先做，让后续清理永久生效）

### T1｜`tokens.css` 接入生成管道　✅ 已完成（打样）

> 已由打样完成，提交 `fafc0b7`。实现见 `scripts/build-web-tokens.mjs`，
> **执行 T2 前必读 `docs/VI-CONVERGENCE-PILOT-NOTES.md`** —— 里面是这次踩到的坑。

**目标**：消除令牌分叉的根因，而不是修补症状。

**为什么**：`tokens.css` 是手写的，所以它必然漂移。修一次数值只解决今天的问题。

**改动**

- 新建或扩展生成器，从 `packages/design-system/src/tokens.json` 生成 `packages/design-system/src/tokens.css`
- 参考实现：`scripts/build-miniapp-assets.mjs`（同一套读取逻辑，输出目标不同；Web 用 px，小程序用 rpx）
- 阴影必须由 `tokens.json` 的 `elevation` 推导，不得保留手写值
- 输出文件加 `/* GENERATED */` 头
- `package.json` 加 `build:web-tokens`，并纳入 `quality`

**验收**

1. `tokens.css` 首行是 `/* GENERATED`
2. `--sw-shadow-card` 与 `elevation.card` 换算一致
3. `--sw-shadow-overlay` 的 y 值为负（与母版一致）
4. 重新运行生成器无 diff
5. 三个 Web 应用构建通过，视觉无回归

**注意**：`tokens.css` 现有 `--sw-shadow-brand`，`tokens.json` 无对应项。二选一：在 `tokens.json` 的 `elevation` 补 `brand`，或删除该变量并改用现有档位。**不要在生成器里硬写。**

---

### T2｜`check:vi` —— 把小程序的守门人扩展到 Web

**目标**：让新增违规立即失败，存量违规变成可以慢慢还的债。

**为什么**：这是整个计划的关键。批量替换 435 处字号而没有守门人，等于什么都没做 —— 几周内会涨回来。

**改动**

- 以 `scripts/check-miniapp-vi.mjs` 为模板，新建 `scripts/check-vi.mjs`，覆盖 `apps/storefront-web`、`apps/admin-web`、`apps/auth-web`
- 规则：
  | 规则 | 拦什么 |
  | --- | --- |
  | `hardcoded-color` | 硬编码 hex / rgb() / hsl() |
  | `font-size-floor` | 字号 < 12px |
  | `font-weight-ceiling` | `font-black` / `font-extrabold` / `font-weight ≥ 800` |
  | `radius-off-scale` | 不在 VI 四档（8/12/16/24）内的圆角 |
  | `palette-drift` | purple / indigo / cyan / rose / teal / pink 色系 Tailwind 类 |
  | `semantic-duplicate` | yellow / orange / green（与 amber / emerald 撞义） |
  | `stale-generated` | 生成物与仓库不一致 |

- **必须实现 baseline 机制**：
  - 首次运行生成 `scripts/vi-baseline.json`，记录当前每个文件每条规则的违规计数
  - 后续运行：**计数增加即失败，计数减少自动更新 baseline**
  - 提供 `--update-baseline` 用于有意接受的变更
- 沿用小程序那套单行豁免：`vi-allow: <规则> — <理由>`，**无理由的豁免本身算失败**
- 纳入 `npm run quality`

**验收**

1. 首次运行通过，生成 baseline，记录约 166 hex / 435 字号 / 199 字重
2. 故意在任意 `.tsx` 加一处 `#123456`，运行必须失败
3. 删掉任意一处既有违规，运行通过且 baseline 自动下降
4. 无理由豁免必须失败

---

### T3｜三端令牌同源断言

**目标**：防止任何一端再次脱离母版。

**改动**：新增测试，断言 `tokens.css` / `tokens.wxss` / `mobile-platforms` 派生值均可由 `tokens.json` 重新推导。任一不一致即失败。

**验收**：手动改 `tokens.css` 一个值，测试必须红。

---

## 4. 设计任务

### D1｜橙红裁决（**必须先于任何配色改动**）

**背景**：`#FF7A00` 出现 54 次、`#E5484D` 53 次，均不在 VI 调色板内。

**已知线索**：`#FF7A00` 分布在 **24 个文件**，其中包含 `HeaderBar.tsx`、`MobileBottomNav.tsx`、`ProductCard.tsx`、`QuickViewModal.tsx`、`ToastContainer.tsx` 等**框架级共享组件**。运营活动色通常不会出现在导航栏和 Toast 里，因此**大概率是历史原型带入的第二品牌色，而非甲方指定活动色**。

**执行方要做的**

1. 打开 `apps/storefront-web/src/components/common/ProductCard.tsx` 与 `HeaderBar.tsx`，确认这两色的实际语义（促销标签？主按钮？强调文字？）
2. 写成一页说明交 Ethan 裁决，**不要自行决定**
3. 两种结果的处理方式：
   - **是活动色** → 写入 VI 作为受控活动色，限定使用位置与生效期，不做一刀切收敛
   - **是结构色** → `#FF7A00` 收敛为品牌渐变 `135deg #1F5EFF → #143A8F`；`#E5484D` 收敛为 VI 风险色 `#DC2626`，且只用于语义位

**验收**：Ethan 书面确认后才进入 D2/D3 的配色部分。

---

### D2｜Web 移动端底栏改为会员码中心

**目标**：让 Web 移动版符合冻结决议第 8 条。

**这不是"向小程序看齐"，是 Web 当前处于违规状态。**

**改动**

- `apps/storefront-web/src/components/common/MobileBottomNav.tsx`
- 五栏固定为 `首页 / 分类 / 会员码 / 订单 / 我的`，与 `tokens.json` 的 `wingCode.navigation` 逐字一致
- 中央会员码：白色圆形承载、品牌蓝图标、上浮、克制阴影。尺寸取 `mobile-platforms.json` 的 iOS/Android 档位
- 购物车移出底栏，改为常驻右上角全局入口（首页、分类、搜索、列表、详情都要有，带角标）
- 会员码图标使用 `packages/design-system/src/brand/wing-code-symbol.svg`，**不得用通用图标库代替**

**验收**

1. 五栏文案与 `wingCode.navigation` 完全一致
2. 购物车在四类页面均可见且有角标
3. `check:vi` 通过

---

### D3｜影像最小集（**唯一需要外部资源的任务**）

**目标**：让首页脱离占位状态。

**需要 Ethan 提供**
| 素材 | 数量 | 用途 |
| --- | ---: | --- |
| 员工专享福利季主视觉 | 1 | 小程序首页 hero |
| 商品图 | 8 | 推荐位、商品卡 |
| 卖场 Logo | 5 | 麦德龙 / 沃尔玛 / 山姆 / 大润发 / 永辉 |

**卖场 Logo 放置方式**：文件名固定 `metro / walmart / sams / rt-mart / yonghui`，格式 `.png/.jpg/.jpeg/.webp`，目录 `apps/wechat-miniapp/miniprogram/assets/partners/`。放好后运行 `npm run build:miniapp-assets`，`data/assets.generated.js` 自动更新，组件自动从文字标签切换为 Logo，**布局不变、不需要重新验收**。

**未取得书面授权前不得使用卖场 Logo**（总纲 §1.7、冻结决议 14）。执行方不得从网络抓取 Logo 文件入库。

**素材到位前**：保持现有占位。**不得自行绘制近似主视觉或商品图**（`02-VI与产品冻结规则` 的「禁止想象与临时手绘」）。

---

## 5. 功能任务

### F1｜小程序阶段 3：会员码三页

**前置**：Ethan 确认首页通过。

**范围**：动态会员码 / 数字会员卡 / 会员码安全状态。

**硬要求**（`docs/mobile/WING-CODE-WECHAT-MINIAPP-MASTER-PLAN.md`）

- 二维码与条形码并存，45 秒倒计时
- 五种状态齐全：正常 / 手机未认证 / 账号冻结 / 会员码停用 / 核验失败。每种**必须同时有图标、文字、颜色**，不得只靠颜色
- 码内不得出现姓名、手机号、企业名、余额、消费记录
- **不得用静态假二维码冒充**。原型阶段可用明确标注的模拟码，但代码结构必须预留服务端挑战凭证
- 「AI 洞察」图标用 `bot`（已确认决议 #7），需先加入生成器 MANIFEST

---

### F2｜小程序令牌会话通道

**这是挡住小程序所有登录的那堵墙，不只是微信登录。**

Web 用 `__Host-` Cookie 会话，小程序没有 cookie 容器，因此账号密码登录同样进不来。

**范围**

- 服务端签发短期 Bearer 令牌，绑定 member / session / device / authzVersion
- `apps/wechat-miniapp/miniprogram/utils/api.js` 接线（当前 `BASE_URL` 为空）
- MP 后台配置 request 合法域名白名单（HTTPS）

**注意**：`AppSecret` 只能存在于服务器环境变量，**永远不进仓库、不进小程序代码、不进截图**。

---

### F3｜`storefront-web` 切断 mock 生产路径

**优先级说明：这一项比配色紧急，但它是架构任务不是设计任务。**

**现状**：`apps/storefront-web` 的 10 个业务页面没有一个直接调用 `/api/v1`，全部经由 `MallContext → mallService → MallState → localStorage + MOCK 数据`。`useProductionSync` 只覆盖 user/余额/mall/orders/ledger/products 六项；卡券、售后、收藏、地址仍由 localStorage 承担。`/home` 请求失败时 `setSessionStatus('guest')`，页面继续渲染 `MOCK_USER` 的余额与 `MOCK_ORDERS` 的订单，**无任何降级提示**。

**要求**

- API 失败必须呈现显式错误态，**不得静默回落到演示数据**
- 参考小程序的做法：`data/demo.js` 的 `IS_DEMO` 标志 + 页面顶部演示横幅
- `useProductionSync` 未覆盖的四类数据（卡券/售后/收藏/地址）要么接线，要么明确标注为演示

**在这之上做配色翻新，是给一个数据层仍为演示级的应用做外观整容。**

---

## 6. 执行顺序

```
T1 ──► T2 ──► T3          脚本工作，不碰界面，一到两天
                │
                ├──► D1（裁决）──► D2
                │
                ├──► 用 T2 的 baseline 逐步还债
                │     字号 435 → 0、字重 199 → 0、hex 166 → 0
                │     每次减少 baseline 自动下降，不必一次改完
                │
                ├──► F1 / F2 并行（不依赖素材）
                │
                └──► D3（等 Ethan 供图）

F3 独立进行，不阻塞上述任何一项，但影响系统可信度
```

**依赖说明**

- T2 必须早于任何批量清理，否则清理会回潮
- D1 必须早于任何配色改动
- D3 是唯一被外部资源阻塞的任务，不要让它挡住 F1/F2
- F1 需要 Ethan 先确认首页

---

## 7. 验收与复核命令

```bash
# 现有
npm run build:miniapp-assets
npm run check:miniapp

# T1/T2 完成后新增
npm run build:web-tokens
npm run check:vi

# 全量门禁（应包含以上全部）
npm run quality
```

复核第 1 节基线数字：

```bash
cd apps/storefront-web/src
grep -rhoE 'font-size:\s*(8|9|10|11)px|text-\[(8|9|10|11)px\]' . --include=*.tsx --include=*.css | wc -l
grep -rhoE 'font-(black|extrabold)' . --include=*.tsx | wc -l
grep -rhoE '#[0-9a-fA-F]{6}\b' . --include=*.tsx --include=*.css | wc -l
```

---

## 8. 每次提交前的自检

- [ ] `npm run check:vi` 与 `npm run check:miniapp` 均通过
- [ ] 未手改任何 `/* GENERATED */` 文件
- [ ] 未修改 `tokens.json` 的数值
- [ ] 涉及界面的改动附微信开发者工具或浏览器真实截图
- [ ] 与母版有偏离的地方，写入差异清单：一致 / 有意适配 / 尚未完成
- [ ] 需要 Ethan 裁决的问题单独列出，**不自行决定**

---

## 附：两份评估的取舍说明

两份独立评估结论方向一致（主 Shop 偏离、小程序更合规），差别在方法：一份是印象加引用，一份是可复现计数。本计划采用后者，并已逐条复核（第 1 节）。

采纳但作了三处修正：

1. **令牌分叉不是双向漂移，是 `tokens.css` 单方面偏离**，且根因是它从未接入管道 —— 所以 T1 是"接管道"而非"改数值"。
2. **不以「同源度」为执行目标**（理由见 1.3）。
3. **机制先于清理**。原建议把批量替换排在前面，本计划把守门人（T2）排在前面，否则清理会回潮。小程序已因缺乏机制失败过两次。

保留的重要提醒：橙红两色在动手前必须裁决。这条提醒是对的。
