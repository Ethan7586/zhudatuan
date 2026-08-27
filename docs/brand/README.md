# 智慧翼 Smart Wing VI 文档入口

## 当前正式基线

1. [智慧翼 Smart Wing 统一 VI 1.0](./SMART-WING-UNIFIED-VI-1.0.md)
2. [统一移动 VI 1.0 总板](./design-previews/smart-wing-unified-mobile-vi-1.0.png)
3. 工程令牌：`packages/design-system/src/tokens.css` 与 `tokens.json`
4. 三端映射：`packages/design-system/src/mobile-platforms.json`

以下原始说明保留用于资产生成和商标原稿替换流程。若与《统一 VI 1.0》冲突，以《统一 VI 1.0》为准。

# 智慧翼 Smart Wing VI 资产说明

本目录定义三个产品端共用的品牌基线：员工商城、统一登录、运营管理后台。

> 当前 W/翼形标志已冻结为项目 VI 1.0 工程母版。若未来收到具有更高法律效力的正式商标原稿，只替换 `packages/design-system/src/brand/` 中的母版并重新生成资产，各端不再逐页修改。

## 统一写法

- 中文品牌：`智慧翼`
- 英文品牌：`Smart Wing`（保留空格，不写 `SmartWing`）
- 产品全称：`智慧翼企业福利商城`
- 后台标题：`运营管理后台｜智慧翼企业福利商城`
- 登录标题：`统一登录｜智慧翼企业福利商城`

## 核心视觉

| 名称     | 色值      | 用途                   |
| -------- | --------- | ---------------------- |
| 智慧蓝   | `#1F5EFF` | 主按钮、焦点、品牌强调 |
| 深海蓝   | `#143A8F` | 品牌渐变、可信赖场景   |
| 墨蓝     | `#07182F` | 后台侧栏、深色背景     |
| 雾面白   | `#F5F7FA` | 页面背景               |
| 正文墨色 | `#172033` | 正文与标题             |

颜色、圆角、字体和阴影的工程令牌位于 `packages/design-system/src/tokens.css`。三个应用必须导入该文件；新增界面优先使用 `var(--sw-*)`，不再新增近似品牌蓝。

## 标志使用

- 小于 96px 的场景只用方形图标，不用横向组合。
- 图标四周至少保留图标宽度的 1/4 作为安全区。
- 深色、浅色背景均使用原始渐变标志；禁止拉伸、旋转、改色、添加描边。
- 页面里图标与“智慧翼”文字同时出现时，图标 `alt` 留空，避免读屏重复朗读；图标单独出现时提供“智慧翼”替代文本。

## 三端接入规则

- 员工商城（App Router / Vinext）：`app/icon.svg`、`app/icon1.png`、`app/icon2.png`、`app/apple-icon.png`、`app/opengraph-image.png`、`app/manifest.ts` 与 metadata。关键资源使用框架文件约定，不依赖普通 `public/` 静态目录。
- 运营后台（Vite）：`public/brand/` + `index.html` 中的 favicon、manifest、Open Graph。
- 统一登录（Vite `/login/`）：同样使用 `public/brand/`，所有本地资源通过 `%BASE_URL%` 保持子路径正确。

运行 `npm run brand:assets`，会从唯一 SVG 母版重新生成各端的 PNG、图标、横向组合和微信分享图。

## 微信 / 企业微信分享

`share-wechat.png` 是 1200×630 的链接卡片首图，三个端均已接入 Open Graph。它解决普通链接预览的品牌一致性；若后续需要自定义微信标题、描述、指定缩略图的稳定强控制，还需要企业主体的微信公众号 / 企业微信 JS-SDK 凭据和签名服务，不能只靠前端 meta 标签承诺。

## 正式 VI 到件后的替换验收

1. 对照甲方品牌手册确认中文、英文、颜色与保护区。
2. 替换 SVG 母版，运行 `npm run brand:assets`。
3. 构建三个应用，检查标签页、桌面添加图标、登录页、商城头部和后台侧栏。
4. 在微信与企业微信各发送一次生产链接，核对标题、描述、缩略图。
5. 将甲方书面确认日期记录在本目录变更记录中。
