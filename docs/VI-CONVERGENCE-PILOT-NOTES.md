# T1 打样心得

版本：1.0　日期：2026-08-14　执行者：Claude（打样）　后续执行者：Codex

配套文件：`docs/VI-CONVERGENCE-EXECUTION-PLAN.md`
参照提交：`fafc0b7 feat(design-system): generate tokens.css from tokens.json`

---

## 0. 这份文件是什么

T1 已经由我做完，作为样板。这份心得记录**执行过程中真实遇到的问题和判断**，供后续任务（T2、T3 及 D/F 系列）参照。

不是流程说明，是**踩过的坑**。

---

## 1. 先量边界，再动手

计划里写的是"把 `tokens.css` 接入管道"。动手前我先问了一个问题：**改坏了会影响多少地方？**

```bash
# tokens.css 定义了哪些变量
grep -oE "^\s*--sw-[a-z0-9-]+" packages/design-system/src/tokens.css | sort -u

# 三个 Web 应用实际用了哪些
grep -rhoE "var\(--sw-[a-z0-9-]+" apps/*/src --include=*.tsx --include=*.css | sort | uniq -c | sort -rn
```

结果出乎意料：

|                         |       数量 |
| ----------------------- | ---------: |
| `tokens.css` 定义的变量 |   约 60 个 |
| 三个应用**实际使用**的  |   **8 个** |
| 其中 `--sw-brand` 一个  | **554 次** |

**这个数字改变了整件事的性质。** 原本以为是"高风险重构"，实际只有 8 个变量有真实调用方，改坏了立刻能发现。

**给 Codex 的规则：任何"重构现有文件"的任务，第一步都是量出真实调用面。** 不要凭文件大小估风险。

**顺带一个发现值得记录**：评估报告里说 Web 有「509 处 `var(--sw-*)`」，听起来令牌落地不错。实际是**一个颜色被用了 554 次**，其余 59 个变量基本没人用。令牌体系存在，但没有被消费。这个结论比"509 处"有用得多，而它只需要一条 `uniq -c` 就能看出来。

---

## 2. 三类差异要分开处理，不能一锅端

生成完立刻和旧版做 diff。出现的差异分成三类，处理方式完全不同：

```bash
diff <(grep -oE "^\s*--sw-[a-z0-9-]+:.*" tokens-before.css | sed 's/^ *//') \
     <(grep -oE "^\s*--sw-[a-z0-9-]+:.*" tokens.css      | sed 's/^ *//')
```

| 类别         | 例子                          | 处理                 |
| ------------ | ----------------------------- | -------------------- |
| **有意修复** | `shadow-card` 双层 → 单层     | 这就是任务目标，保留 |
| **无害归一** | `#1f5eff` → `#1F5EFF`         | 跟随母版，不管       |
| **意外回归** | 字体族丢引号、丢 `Arial` 兜底 | **必须修**           |

第三类是我自己在写生成器时引入的。`type.families.chinese` 直接拼进去，结果 `'PingFang SC'` 变成了没引号的 `PingFang SC`，还把原有的 `Arial` 兜底弄丢了。

无引号的多词字体名在 CSS 里合法，但脆弱；丢掉 `Arial` 是**行为变更**。这两样都不在任务范围内，属于"顺手改坏的东西"。

**给 Codex 的规则：管道化任务里，任何不属于任务目标的差异都是回归，哪怕它看起来无害。** diff 要逐行看完，不能只确认目标项变了就收工。

修法是加一个 `quoteFamilies()`，并把 `Arial` 显式补回。

---

## 3. 孤儿变量：宁可删，不要编

`tokens.css` 里有 `--sw-shadow-brand: 0 10px 28px rgb(31 94 255 / 18%)`，而 `tokens.json` 的 `elevation` 里**没有对应项**。

三个选择：

1. 在 `tokens.json` 补一个 `elevation.brand` —— 但这是改母版，需要 Ethan 批
2. 在生成器里硬写这个值 —— **这会让生成器自己变成第二个真值源，正好是我们要消灭的东西**
3. 删掉

我先查了调用面：**0 次使用**。选 3。

**给 Codex 的规则：生成器里不允许出现任何不能从母版推导的字面量。** 遇到孤儿项，先查调用面：

- 无人使用 → 删，在 commit 里说明
- 有人使用 → **停下来问 Ethan**，让他决定是补母版还是改调用方。不要自己在生成器里硬写。

硬写一个值，等于把漂移搬了个家。

---

## 4. 发现了一个语义错配，但没有自己改

`tokens.json` 的 `elevation.overlay` 是 **y = −2px（向上投影）**。

向上投影是给小程序底栏用的。但 Web 的 `--sw-shadow-overlay` 语义上应该是弹层/模态框，**那应该向下**。

也就是说：`elevation.overlay` 这个名字是通用的，但数值是为底栏写的。

我**没有改**。理由：

- 改 `tokens.json` 的数值是计划第 2 节明令禁止的
- 更合理的做法是把它改名为 `elevation.bottomBar`，另外新增一个真正的 `elevation.overlay` —— 但这是母版结构变更，要 Ethan 决定
- 当前 `--sw-shadow-overlay` 在三个应用里**调用面为 0**，不影响任何东西

所以我如实生成、如实记录，把它列进待裁决。

**给 Codex 的规则：发现母版有问题时，忠实生成 + 登记问题，不要顺手"修正"母版。** 母版错了也是母版，改它需要 Owner 拍板。悄悄改对了，下次就没人知道为什么是这个值。

**待 Ethan 裁决：`elevation.overlay` 是否拆成 `bottomBar`（向上）与 `overlay`（向下）两项。**

---

## 5. 命名统一是另一个任务，不要顺手做

Web 和小程序对同一个概念用了不同变量名：

| 概念     | Web                      | 小程序              |
| -------- | ------------------------ | ------------------- |
| 辅助文字 | `--sw-muted`             | `--sw-text-muted`   |
| 小圆角   | `--sw-radius-sm`         | `--sw-radius-small` |
| 小正文   | `--sw-font-size-body-sm` | `--sw-fs-bodySmall` |
| 半格间距 | `--sw-space-0-5`         | `--sw-space-half`   |
| 快动效   | `--sw-duration-fast`     | `--sw-motion-fast`  |

看起来该顺手统一。**我没有做。**

统一要动 554 个调用点，需要 codemod，而且一旦出错会同时打断三个应用。它和"接入管道"是两件事，混在一个提交里会让回滚变得不可能。

**给 Codex 的规则：一个提交只做一件事。** T1 的目标是"单一真值源"，不是"同名"。**同源不等于同名** —— 只要两边都从 `tokens.json` 派生，命名不同不会造成漂移，只会造成阅读成本。

命名统一值得单独立项，但优先级低于 T2。

---

## 6. 三条验证，缺一不可

提交前跑完这三条才算完成：

```bash
# ① 幂等：再生成一次不应产生 diff
node scripts/build-web-tokens.mjs --check

# ② 调用面完整：应用真正在用的变量一个都不能少
for v in --sw-brand --sw-brand-dark --sw-brand-light --sw-sidebar-top \
         --sw-brand-ink --sw-text --sw-font-sans --sw-background; do
  grep -q "^\s*$v:" packages/design-system/src/tokens.css && echo "OK $v" || echo "丢失 $v"
done

# ③ 真实构建：三个应用都要过
npm run build:storefront && npm run build:admin && npm run build:auth
```

① 是所有生成器的基本要求 —— 不幂等说明生成逻辑里混了随机性或未排序的遍历。

② 比"文件生成成功"重要得多。生成器跑通但少输出一个变量，构建照样过，页面到运行时才崩。

③ 不能省。CSS 变量的错误大多不在构建期暴露，但至少能挡住语法级错误。

**`--check` 模式是必须的**，不能只有写入模式。守门人脚本要调用它来判断生成物是否过期，而**检查器绝对不能重写工作区** —— 一个会自己修好问题的检查等于没有检查。

---

## 7. 这次的实际改动清单

```
新增  scripts/build-web-tokens.mjs          生成器，带 --check
改写  packages/design-system/src/tokens.css 变成生成物，加 /* GENERATED */ 头
改动  package.json                          build:web-tokens / check:web-tokens
                                            check:web-tokens 已进 quality
```

净效果：

| 变量                    | 改前                                | 改后                             |
| ----------------------- | ----------------------------------- | -------------------------------- |
| `--sw-shadow-card`      | `0 1px 2px 6% + 0 6px 18px 5%` 双层 | `0 1px 4px rgba(7,24,47,.04)`    |
| `--sw-shadow-overlay`   | `0 16px 40px 16%`                   | `0 -2px 12px rgba(7,24,47,.08)`  |
| `--sw-wing-code-shadow` | `0 8px 24px 22%`                    | `0 4px 12px rgba(31,94,255,.24)` |
| `--sw-shadow-brand`     | 存在                                | 删除（0 调用）                   |
| hex 大小写              | 小写                                | 跟随母版大写                     |

**三个 Web 应用构建全部通过，`check:miniapp` 通过，生成器幂等。**

---

## 8. 对 T2 的提前提醒

T2（`check:vi` 守门人）是整个计划里最难的一项，比 T1 难得多。三条来自 T1 的经验可以直接套用：

1. **先量基线再写规则。** 基线数字已在计划第 1 节给出（166 hex / 435 小字号 / 199 超粗字重），但 T2 要按**文件粒度**重新统计，因为 baseline 需要精确到文件。

2. **`--check` 与写入分离。** 参照 `build-web-tokens.mjs` 和 `build-miniapp-assets.mjs`，两者都实现了这个模式。**检查器不得修改工作区。**

3. **豁免必须带理由，无理由的豁免本身算失败。** 这条已在 `check-miniapp-vi.mjs` 实现，直接复用那段逻辑：

   ```js
   const waived = (rule) => {
     const match = raw.match(new RegExp(`vi-allow:\\s*${rule}\\s*(.*)`));
     if (!match) return false;
     if (!match[1].replace(/[-—\s*/]/g, '')) {
       fail(rel, at, 'waiver-without-reason', `vi-allow: ${rule} 必须写明理由`);
     }
     return true;
   };
   ```

   这个设计的用意：让"悄悄绕过"不比"好好做"更省力。**没有这一条，白名单机制会在两周内变成垃圾场。**

另外一条 T1 没遇到但 T2 一定会遇到的：**误报比漏报更危险**。检查器报了一条假警告，执行者的第一反应是加豁免而不是查证；假警告多了，整个检查就没人信了。`check-miniapp-vi.mjs` 已经出过一次这种事 —— 它把 `wx.showToast` 的 `icon: 'none'` 参数当成了缺失的设计图标。**写完每条规则，都要故意造一个"看起来像违规但其实合法"的样本试一下。**
