# Smart Wing VI 1.3

智慧翼跨平台中文排版视觉系统交付包。

- 版本：`1.3.0`
- 基线：Smart Wing VI 1.2.0
- 发布日期：`2026-09-01`
- 本次升级：简体中文字体、跨平台回退、字体样张、静态导出规范

## VI 1.3 的结论

VI 1.3 不再依赖操作系统碰巧安装了什么字体。Web 与静态设计稿统一使用自托管字体：

- 拉丁、数字：`SW Inter`
- 简体中文：`SW Noto Sans SC`
- macOS 失败回退：`PingFang SC`
- Windows 失败回退：`Microsoft YaHei UI`
- Linux 失败回退：`Noto Sans CJK SC`

只要字体资源正常加载，macOS 与 Windows 的汉字字形、字重和占位宽度保持一致。

## 目录

- `CHINESE-TYPOGRAPHY-STANDARD.md`：VI 1.3 中文排版权威规范。
- `source/packages/design/`：`@shop/design` 1.3.0 源码、Token、字体和排版样式。
- `source/packages/design/src/fonts.css`：自托管字体声明。
- `source/packages/design/src/typography.css`：中文排版模板类。
- `source/packages/design/src/fonts/`：字体二进制及许可证。
- `preview/vi-1-3-han-template.html`：中文字体与混排样张。
- `screenshots/VI-1.3-Chinese-Typography.png`：确认用静态样张。
- `Open-VI-1.3-Preview.command`：macOS 双击预览。

## 接入顺序

```css
@import '@shop/design/fonts.css';
@import '@shop/design/tokens.css';
@import '@shop/design/base.css';
@import '@shop/design/typography.css';
```

业务界面继续使用 `--sw-*` Token，不在页面内自建第二套字体栈。

## 权威文件

- Token：`source/packages/design/src/tokens.json`
- CSS Token：`source/packages/design/src/tokens.css`
- 字体交付：`source/packages/design/src/fonts.css`
- 中文排版：`source/packages/design/src/typography.css`
- 完整规范：`CHINESE-TYPOGRAPHY-STANDARD.md`

## 校验

```bash
cd source
node 04_tools/scripts/build-web-tokens.mjs --check
```

字体验收必须同时满足：浏览器字体已加载、无宋体回退、无伪粗体、中文不低于 12px、静态导出等待 `document.fonts.ready`。

## 预览

macOS 可直接双击 `Open-VI-1.3-Preview.command`。也可以手动执行：

```bash
cd /Users/Ethan/Desktop/zdt-next/05_docs_ziliao/VI_shijue/version-upgrades/ZHU-VI-1.3
python3 -m http.server 4194
```

然后访问 `http://127.0.0.1:4194/preview/vi-1-3-han-template.html`。
