# Smart Wing VI 1.2

智慧翼工作台基础视觉系统完整交付包。

- 版本：`1.2.0`
- Git Commit：`f7b13e239b496111d382190ed1c5a7abb7382dd3`
- Git Branch：`origin/codex/vi-1-2-foundation-20260901`
- 发布日期：`2026-09-01`

## 目录

- `source/packages/design/`：完整 `@shop/design` 1.2.0 源码、Token、组件、品牌 SVG、测试和 Story。
- `source/scripts/build-web-tokens.mjs`：Web Token 生成器。
- `source/scripts/build-miniapp-theme.mjs`：小程序主题生成器。
- `preview/`：已经构建好的完整 Storybook 静态预览。
- `screenshots/`：VI 1.2 桌面和手机效果图。
- `Open-VI-1.2-Preview.command`：双击启动本地预览。

## VI 1.2 新增基础组件

- `WorkspaceHero`：工作台顶部品牌、标题、说明、元信息和主操作。
- `MetricGrid` / `MetricCard`：经营指标和状态概览。
- `MasterDetail` / `MasterItem`：左侧选择、右侧详情的主从工作区。
- 继续复用 VI 1.1 的 `Dialog`、`Button`、`Badge`、`Surface`、`ResourceState`、`ResourcePanel` 等组件。

## 权威文件

- Token：`source/packages/design/src/tokens.json`
- TypeScript Token：`source/packages/design/src/Token.ts`
- CSS Token：`source/packages/design/src/tokens.css`
- VI 1.2 样式：`source/packages/design/src/vi-1-2-foundation.css`
- 完整组合示例：`source/packages/design/src/VI12Foundation.stories.tsx`

## 使用原则

1. 业务页面通过 `@shop/design` 的公开 export 使用组件。
2. 不复制组件源码到业务模块，不重复创建第二套 VI。
3. 颜色、间距、圆角、阴影、字号和动效使用 `--sw-*` Token。
4. 页面按模块逐个接入；未接入的页面不会被全局强制换皮。
5. 若要接入 zhudatuan 仓库，优先合并上面的 Git Commit，而不是复制本交付包覆盖仓库。

## 重新生成 Token

在本目录执行：

```bash
cd source
node 04_tools/scripts/build-web-tokens.mjs
```

校验生成文件没有漂移：

```bash
cd source
node 04_tools/scripts/build-web-tokens.mjs --check
```

## 预览

macOS 可直接双击 `Open-VI-1.2-Preview.command`。也可以手动执行：

```bash
cd preview
python3 -m http.server 4193
```

然后访问 `http://127.0.0.1:4193/`。
