# Smart Wing VI 1.3 简体中文排版标准

## 1. 标准目的

这套标准解决四件事：

1. macOS、Windows 和 Linux 的简体中文界面保持同一视觉气质。
2. 浏览器、PNG、PDF 和设计方案图不再意外回退成宋体。
3. 中文、英文、数字、金额和工程标识建立稳定混排规则。
4. 设计师、前端和后端生成的用户可见内容使用同一排版口径。

## 2. 字体决策

### 2.1 权威字体

| 内容 | 标准字体 | 字重 | 用途 |
| --- | --- | --- | --- |
| 简体中文 | `SW Noto Sans SC` | 400–700 | 标题、正文、按钮、表格、状态 |
| 拉丁与数字 | `SW Inter` | 400–700 | 英文、数字、金额、日期、比例 |
| 工程标识 | 系统等宽字体 | 500 | ID、原因码、版本、哈希 |

`SW Noto Sans SC` 是自托管 `Noto Sans SC` 的 CSS 家族别名。Noto 官方说明该字体覆盖简体中文并提供可变字体；字体采用 OFL，可用于数字和商业产品。来源：[Noto CJK 官方仓库](https://github.com/notofonts/noto-cjk)、[Noto 使用说明](https://github.com/notofonts/noto-docs/blob/main/docs/website/use.md)。

### 2.2 回退顺序

```css
--sw-font-sans:
  'SW Inter',
  'SW Noto Sans SC',
  Inter,
  'Noto Sans SC',
  'PingFang SC',
  'Microsoft YaHei UI',
  'Microsoft YaHei',
  'Hiragino Sans GB',
  'Noto Sans CJK SC',
  Arial,
  sans-serif;
```

自托管字体成功时，所有平台都使用同一字形。只有资源加载失败时才进入系统回退。微软官方将 `Microsoft YaHei UI` 定义为 Windows 简体中文界面字体，因此它是 Windows 第一回退，而不是宋体：[Microsoft Windows Typography](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography)。

### 2.3 禁止项

- 禁止把 `SimSun`、`宋体`、`STSong` 放进 UI 字体栈。
- 禁止只写 `sans-serif` 后直接导出静态图片。
- 禁止浏览器伪造不存在的粗体，统一设置 `font-synthesis: none`。
- 禁止将 macOS 的苹方当作跨平台唯一字体。
- 禁止从 Google Fonts 在线地址直接加载；中国生产环境必须自托管。

## 3. 中文字号模板

| 层级 | 字号/行高 | 字重 | 使用范围 |
| --- | --- | --- | --- |
| Display | 32/40 | 700 | 仅限关键工作台标题或核心数字 |
| H1 | 28/36 | 700 | 页面主标题 |
| H2 | 20/28 | 600 | 页面区块标题 |
| H3 | 17/24 | 600 | 卡片、详情分区标题 |
| Body | 16/24 | 400 | 主要说明和阅读正文 |
| Body Small | 14/20 | 400 | 表格、筛选、辅助说明 |
| Label | 14/20 | 600 | 按钮、字段标签、状态标签 |
| Caption | 12/18 | 400 | 时间、水位、来源、次要元信息 |
| 中文引导词 | 12/18 | 600 | “订单概览”“异常处理”等中文栏目引导 |

中文界面最低字号为 12px。11px 及以下只允许纯装饰或非中文图形标记，不承载业务信息。

## 4. 字重规则

| 字重 | 语义 |
| --- | --- |
| 400 | 正文、表格值、说明、时间线 |
| 500 | 短标签、可交互文本、工程标识 |
| 600 | 标题、按钮、状态、关键字段名 |
| 700 | 页面主标题、关键金额、重要指标；避免用于长中文句子 |

同一行中文最多使用两个字重。不要用“全粗体”代替信息层级。

## 5. 汉字排版规则

1. 中文正文和标题默认字间距为 `0`，不使用 2px 一类固定拉宽。
2. 英文 Overline 可以使用大写和字距；中文栏目引导词必须使用独立的 `hanKicker`，不自动大写、不拉开汉字。
3. 使用简体中文全角标点：`，。！？；：“”‘’（）【】《》—…`。
4. 中文单位紧跟数字：`12分钟`、`20小时`、`30天`；金额使用 `¥2,180.00`。
5. 中文与英文缩写之间按语义留一个空格：`SLA 剩余12分钟`、`OMS 订单`。
6. 订单号、原因码、哈希不得翻译；使用等宽字体并允许安全换行。
7. 中文文本使用严格换行规则，禁止标点出现在行首。
8. 按钮文案优先 2–6 个汉字；不要为了对齐插入空格。

## 6. 混排模板

```text
订单 OMS-20260901-1827 已支付，履约 SLA 剩余12分钟。
异常原因：PROVIDER_PURCHASE_UNKNOWN
退款金额：¥2,180.00
数据已处理至2026-09-01 16:52:10。
```

- 中文使用 `SW Noto Sans SC`。
- 拉丁、数字和金额由前置的 `SW Inter` 自动承载。
- 原因码使用 `.swtype-identifier`，不强制与中文共用字体。
- 金额和表格数字使用 `tabular-nums`，保证列对齐。

## 7. 平台行为

| 环境 | 正常结果 | 字体失败时 |
| --- | --- | --- |
| macOS 浏览器 | SW Inter + SW Noto Sans SC | PingFang SC |
| Windows 浏览器 | SW Inter + SW Noto Sans SC | Microsoft YaHei UI |
| Linux/容器 | SW Inter + SW Noto Sans SC | Noto Sans CJK SC |
| PNG/PDF 导出 | 等待 Web Font 后导出 | 失败并停止，不允许静默宋体 |

## 8. 静态导出规则

1. 设计方案图和样张必须通过 Chromium/WebKit 渲染。
2. 导出前等待 `document.fonts.ready`。
3. 验证 `document.fonts.check('16px "SW Noto Sans SC"')` 返回成功。
4. PNG 不使用 `sips` 直接栅格化含中文的 SVG。
5. PDF 必须嵌入字体；无法嵌入时停止交付。
6. SVG 若需脱离浏览器分发，应嵌入字体或将最终确认文字转为路径；源文件仍保留可编辑文本。

## 9. 性能与发布

- 当前交付包保留完整简体中文可变字体，优先保证正确性和离线导出。
- 生产 Web 应按 Unicode Range 切分 WOFF2，并保持同一家族名和字重轴。
- 字体静态资源使用长期缓存和内容哈希；更新字体时提升文件名版本。
- 页面首次加载允许回退显示，但截图、PDF 和验收不得在字体未就绪时执行。

## 10. 验收门槛

- macOS 与 Windows 截图中的同一汉字形态一致。
- 页面不存在宋体、仿宋或衬线体回退。
- 400/500/600/700 四个字重可被浏览器真实加载。
- 12px 中文在 100% Windows 缩放下可读。
- 中英文、金额和原因码混排不跳行、不挤压。
- 1440、1280、1024、768 和 390 宽度下无文字裁切。
- PNG 与浏览器预览字体一致。
