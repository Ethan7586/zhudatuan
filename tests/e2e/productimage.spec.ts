import { resolve } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { LOCAL_CONSOLE_ORIGIN } from '@shop/config/client';
import { completeConsoleStepup, signInConsole } from '../browser/Environment';

const PRODUCT_PATH = '/scopes/enterprise/enterprise-zhudatuan/products';
const PNG = resolve('apps/console/public/brand/icon-192.png');
const JPG = resolve('apps/storefront/public/products/care.jpg');

test('商品新增与编辑共用完整图片上传组件并可从失败中直接恢复', async ({ page }) => {
  test.setTimeout(120_000);
  const title = `自动验收图片礼盒 ${crypto.randomUUID().slice(0, 8)}`;
  const changedTitle = `${title} 已更新`;

  await signInConsole(page);
  await page.goto(`${LOCAL_CONSOLE_ORIGIN}${PRODUCT_PATH}`);
  await prepareProductAssurance(page);
  await page.getByRole('button', { name: '新建商品' }).click();
  const create = page.getByRole('form', { name: '新建商品' });
  await expect(create).toBeVisible();
  await create.getByLabel('商品名称').fill(title);
  await create.getByLabel('商品分类').fill('员工精选');

  await chooseUsingButton(page, create, '选择图片', PNG);
  await expect(create.getByAltText(`${title}待上传图片`)).toBeVisible();
  await expect(create.getByText('已选择：icon-192.png')).toBeVisible();
  await create.getByRole('button', { name: '移除图片' }).click();
  await expect(create.getByAltText(`${title}待上传图片`)).toHaveCount(0);

  await chooseUsingButton(page, create, '选择图片', PNG);
  await chooseUsingButton(page, create, '替换图片', JPG);
  await expect(create.getByAltText(`${title}待上传图片`)).toBeVisible();
  await expect(create.getByText('已选择：care.jpg')).toBeVisible();

  let uploadStarted: () => void = () => undefined;
  let abortUpload: () => Promise<void> = async () => undefined;
  const failedUploadStarted = new Promise<void>((resolveStarted) => {
    uploadStarted = resolveStarted;
  });
  await page.route(/\/v1\/public-upload\//, async (route) => {
    uploadStarted();
    await new Promise<void>((release) => {
      abortUpload = async () => {
        await route.abort('failed');
        release();
      };
    });
  });
  await create.getByRole('button', { name: '创建草稿' }).click();
  await failedUploadStarted;
  await expect(create.getByRole('status')).toContainText('正在上传至 OSS');
  await abortUpload();
  await expect(create.getByRole('alert')).toContainText('图片已保留，无需重新选择，可直接重试');
  await expect(create.getByText('已选择：care.jpg')).toBeVisible();
  await page.unroute(/\/v1\/public-upload\//);

  const createUpload = successfulUpload(page);
  await create.getByRole('button', { name: '创建草稿' }).click();
  await expect(await createUpload).toBe(204);
  await expect(create).toBeHidden();
  await expect(page.getByText('商品操作已完成')).toBeVisible();
  await expectProductImage(page, title);

  await openEditor(page, title);
  const edit = page.getByRole('form', { name: '编辑商品' });
  await expect(edit.getByAltText(`${title}当前图片`)).toBeVisible();
  await edit.getByLabel('商品名称').fill(changedTitle);
  await chooseUsingButton(page, edit, '替换图片', PNG);
  await expect(edit.getByAltText(`${changedTitle}待上传图片`)).toBeVisible();

  const updateUpload = successfulUpload(page);
  await edit.getByRole('button', { name: '保存修改' }).click();
  await expect(await updateUpload).toBe(204);
  await expect(edit).toBeHidden();
  await expectProductImage(page, changedTitle);

  await openEditor(page, changedTitle);
  const remove = page.getByRole('form', { name: '编辑商品' });
  await remove.getByRole('button', { name: '移除图片' }).click();
  await expect(remove.getByText('保存后移除当前图片')).toBeVisible();
  await remove.getByRole('button', { name: '保存修改' }).click();
  await expect(remove).toBeHidden();
  const row = productRow(page, changedTitle);
  await expect(row.locator('.productthumbnail img')).toHaveCount(0);
});

async function prepareProductAssurance(page: Page): Promise<void> {
  await page.getByRole('button', { name: '新建商品' }).click();
  const form = page.getByRole('form', { name: '新建商品' });
  await form.getByLabel('商品名称').fill('身份验证准备');
  await form.getByLabel('商品分类').fill('员工精选');
  await form.getByRole('button', { name: '创建草稿' }).click();
  await completeConsoleStepup(page);
  await expect(page.getByRole('button', { name: '新建商品' })).toBeVisible();
}

async function chooseUsingButton(page: Page, form: Locator, name: string, path: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await form.getByRole('button', { name }).click();
  await (await chooser).setFiles(path);
}

function successfulUpload(page: Page): Promise<number> {
  return page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().includes('/v1/public-upload/')).then((response) => response.status());
}

async function openEditor(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${escape(title)}，.*查看详情$`) }).click();
  const edit = page.getByRole('button', { name: '编辑商品' });
  await expect(edit).toBeEnabled();
  await edit.click();
  await expect(page.getByRole('form', { name: '编辑商品' })).toBeVisible();
}

async function expectProductImage(page: Page, title: string): Promise<void> {
  const row = productRow(page, title);
  await expect(row).toBeVisible();
  const image = row.locator('.productthumbnail img');
  await expect(image).toHaveCount(1);
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
}

function productRow(page: Page, title: string) {
  return page.getByRole('row').filter({ has: page.getByRole('button', { name: new RegExp(`^${escape(title)}，.*查看详情$`) }) });
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
