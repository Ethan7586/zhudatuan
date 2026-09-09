import { expect, test } from '@playwright/test';
import { expectVisualIntegrity, expectVisualReady, inspectVisualIntegrity, inspectVisualReadiness } from '../../scripts/check/VisualIntegrity';

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

test('visual integrity reports clipped copy, overflowing or multiline control copy, viewport breaches and undersized touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`
    <main>
      <strong style="display:block;width:40px;overflow:hidden;white-space:nowrap">这段文案被错误裁切</strong>
      <button style="width:72px;height:44px;white-space:nowrap">查看完整商品治理详情</button>
      <button style="width:72px;min-height:44px;white-space:normal">这段操作文案被挤成多行</button>
      <span style="position:absolute;left:350px;width:80px">越过视口</span>
      <button style="width:32px;height:32px">小</button>
    </main>
  `);

  const issues = await inspectVisualIntegrity(page);

  expect(issues.map(({ kind }) => kind)).toEqual(expect.arrayContaining(['textclipped', 'controlcopyoverflow', 'controlcopymultiline', 'viewportbreach', 'touchtarget']));
});

test('visual integrity permits explicitly declared multiline selection cards', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent('<button data-visual-copy="multiline" style="display:grid;width:80px;min-height:88px;white-space:normal">经营人员负责日常运营与审核</button>');

  await expectVisualIntegrity(page);
});

test('visual integrity accepts accessible ellipsis and rejects unlabeled clipping', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`
    <button data-visual-copy="truncate" aria-label="查看完整商品名称" style="width:120px;min-height:44px"><span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">这是一个非常长的商品完整名称</span></button>
    <span id="unlabeled" style="display:block;width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">这段文案没有可访问的完整说明</span>
  `);

  const issues = await inspectVisualIntegrity(page);
  expect(issues.filter(({ element }) => element.includes('button'))).toEqual([]);
  expect(issues.some(({ kind, element }) => kind === 'textclipped' && element === 'span#unlabeled')).toBe(true);
});

test('visual integrity rejects internal identities unless the business explicitly requires them', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`
    <p>当前商城 mall-zhudatuan</p>
    <span>员工账号 SW_LOCAL_ETHAN</span>
    <p>用户可读订单号 D202609100001</p>
    <span data-visual-identity="required">故障排查引用 order:diagnostic:one</span>
  `);

  const issues = await inspectVisualIntegrity(page);
  expect(issues.filter(({ kind }) => kind === 'technicalidentity').map(({ text }) => text)).toEqual(['mall-zhudatuan', 'SW_LOCAL_ETHAN']);
});

test('visual readiness waits until route and resource placeholders are replaced with business content', async ({ page }) => {
  await page.setContent('<main><div class="statemain"><p role="status">正在加载业务页面…</p></div></main>');
  expect(await inspectVisualReadiness(page)).not.toEqual([]);
  await page.evaluate(() => {
    setTimeout(() => {
      const main = document.querySelector('main');
      if (main) main.innerHTML = '<h1>商品治理台</h1><button style="width:120px;height:44px">新建商品</button>';
    }, 100);
  });
  await expectVisualReady(page);
  expect(await inspectVisualReadiness(page)).toEqual([]);
});

test('visual integrity reports text outside control boundaries, occluded controls and failed images', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`
    <main>
      <button id="outside" style="position:relative;width:88px;height:44px"><span style="position:absolute;left:72px;white-space:nowrap">保存并发布</span></button>
      <button id="covered" style="position:fixed;left:20px;top:100px;width:120px;height:44px">提交订单</button>
      <div style="position:fixed;z-index:2;left:20px;top:100px;width:120px;height:44px;background:white">错误遮挡</div>
      <img id="broken" src="data:image/png;base64,broken" alt="商品主图" style="display:block;width:80px;height:80px" />
    </main>
  `);
  await page.locator('#broken').evaluate((image: HTMLImageElement) => image.complete || new Promise((resolve) => image.addEventListener('error', resolve, { once: true })));

  const issues = await inspectVisualIntegrity(page);
  expect(issues.map(({ kind }) => kind)).toEqual(expect.arrayContaining(['controlcopyboundary', 'controloccluded', 'imagefailure']));
});
