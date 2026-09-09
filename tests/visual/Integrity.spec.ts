import { expect, test } from '@playwright/test';
import { expectVisualIntegrity, inspectVisualIntegrity } from './Integrity';

test('visual integrity accepts semantic card tables and explicit scroll regions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`
    <main>
      <div style="overflow-x:auto;width:300px"><span style="display:block;width:500px">合法横向滚动内容</span></div>
      <table><thead style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)"><tr><th>无障碍表头</th></tr></thead></table>
      <details><summary style="width:80px;height:44px">更多</summary><button style="width:20px;height:20px">隐藏操作</button></details>
      <button style="width:88px;height:44px">正常操作</button>
    </main>
  `);

  await expectVisualIntegrity(page);
});

test('visual integrity reports clipped copy, viewport breaches and undersized touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`
    <main>
      <strong style="display:block;width:40px;overflow:hidden;white-space:nowrap">这段文案被错误裁切</strong>
      <span style="position:absolute;left:350px;width:80px">越过视口</span>
      <button style="width:32px;height:32px">小</button>
    </main>
  `);

  const issues = await inspectVisualIntegrity(page);

  expect(issues.map(({ kind }) => kind)).toEqual(expect.arrayContaining(['textclipped', 'viewportbreach', 'touchtarget']));
});
