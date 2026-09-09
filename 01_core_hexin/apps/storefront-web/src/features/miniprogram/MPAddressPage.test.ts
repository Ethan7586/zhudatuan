// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render as renderDom, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeliveryAddress } from '../../types';
import { switchDefaultAddressOptimistically } from '../../context/addressDefaultState';

const { useMallMock, prepareWechatDeliveryAddressMock, requestWechatDeliveryAddressMock } = vi.hoisted(() => ({
  useMallMock: vi.fn(),
  prepareWechatDeliveryAddressMock: vi.fn(),
  requestWechatDeliveryAddressMock: vi.fn(),
}));

vi.mock('../../components/mobile/WeChatCapsule', () => ({ WeChatCapsule: () => null }));
vi.mock('../../context/MallContext', () => ({ useMall: useMallMock }));
vi.mock('../../services/wechatDeliveryAddress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/wechatDeliveryAddress')>();
  return {
    ...actual,
    prepareWechatDeliveryAddress: prepareWechatDeliveryAddressMock,
    requestWechatDeliveryAddress: requestWechatDeliveryAddressMock,
  };
});

import { MPAddressPage } from './MPAddressPage';
import { WechatAddressRequestError, type WechatAddressRequestOptions } from '../../services/wechatDeliveryAddress';

const ADDRESS_BOOK: DeliveryAddress[] = [
  { id: 'address:one', name: '张三', phone: '13800000000', province: '湖北省', city: '武汉市', district: '武昌区', detail: '一号', isDefault: true, version: 2 },
  { id: 'address:two', name: '李四', phone: '13900000000', province: '浙江省', city: '杭州市', district: '西湖区', detail: '二号', isDefault: false, version: 4 },
];

type DefaultResult = { id: string; isDefault: boolean; version: number };
type PersistDefault = (address: DeliveryAddress) => Promise<DefaultResult>;

let mallValue: ReturnType<typeof createMallValue>;
let runIdleCallback: (() => void) | undefined;

function createMallValue(overrides: Partial<{
  addresses: DeliveryAddress[];
  setDefaultAddress: (addressId: string) => Promise<boolean>;
}> = {}) {
  return {
    addresses: [],
    addAddress: vi.fn(),
    setDefaultAddress: vi.fn().mockResolvedValue(true),
    mpAddressReturnPage: 'cart',
    setMpPage: vi.fn(),
    showToast: vi.fn(),
    ...overrides,
  };
}

function AddressHarness({
  initialAddresses = ADDRESS_BOOK,
  persist,
}: Readonly<{
  initialAddresses?: DeliveryAddress[];
  persist: PersistDefault;
}>) {
  const [addresses, setAddresses] = React.useState(initialAddresses);
  const setDefaultAddress = React.useCallback(async (addressId: string) => {
    try {
      await switchDefaultAddressOptimistically(addresses, addressId, persist, setAddresses);
      return true;
    } catch {
      return false;
    }
  }, [addresses, persist]);

  mallValue = createMallValue({ addresses, setDefaultAddress });
  return React.createElement(MPAddressPage);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mallValue = createMallValue();
  useMallMock.mockImplementation(() => mallValue);
  prepareWechatDeliveryAddressMock.mockReset().mockResolvedValue(undefined);
  requestWechatDeliveryAddressMock.mockReset().mockResolvedValue({
    name: '张三',
    phone: '13800000000',
    province: '浙江省',
    city: '杭州市',
    district: '西湖区',
    detail: '文一路 1 号',
  });
  runIdleCallback = undefined;
  vi.stubGlobal('requestIdleCallback', vi.fn((callback: IdleRequestCallback) => {
    runIdleCallback = () => callback({ didTimeout: false, timeRemaining: () => 50 });
    return 1;
  }));
  vi.stubGlobal('cancelIdleCallback', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('mini-program address page', () => {
  it('offers smart paste, WeChat import and one linked region selector', () => {
    const html = renderToStaticMarkup(React.createElement(MPAddressPage));
    expect(html).toContain('粘贴并识别');
    expect(html).toContain('从微信选择地址');
    expect(html).toContain('请选择省 / 市 / 区');
    expect(html).toContain('aria-label="整段收货地址"');
    expect(html).not.toContain('placeholder="广东省"');
    expect(html).not.toContain('placeholder="深圳市"');
    expect(html).not.toContain('placeholder="南山区"');
    expect((html.match(/<input/g) ?? []).length).toBe(3);
  });

  it('fills the form after WeChat import without saving automatically', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/miniprogram/MPAddressPage.tsx'), 'utf8');
    const importFlow = source.slice(source.indexOf('const importFromWechat'), source.indexOf('const save'));
    expect(importFlow).toContain('setForm(imported)');
    expect(importFlow).not.toContain('addAddress(');
  });

  it('warms the WeChat SDK, signature and configuration only after the address page reaches idle time', async () => {
    renderDom(React.createElement(MPAddressPage));

    expect(prepareWechatDeliveryAddressMock).not.toHaveBeenCalled();
    await act(async () => {
      runIdleCallback?.();
      await Promise.resolve();
    });

    expect(prepareWechatDeliveryAddressMock).toHaveBeenCalledOnce();
  });

  it('shows feedback synchronously before the request resolves, follows the launch states and only fills the form', async () => {
    const pending = deferred<{
      name: string;
      phone: string;
      province: string;
      city: string;
      district: string;
      detail: string;
    }>();
    requestWechatDeliveryAddressMock.mockImplementation((options?: WechatAddressRequestOptions) => {
      options?.onStateChange?.('launching');
      return pending.promise;
    });
    const { container, getByDisplayValue, getByRole } = renderDom(React.createElement(MPAddressPage));

    fireEvent.click(getByRole('button', { name: /从微信选择地址/ }));

    expect(container.querySelector('[data-wechat-address-state="launching"]')?.textContent).toContain('正在拉起微信');

    await act(async () => {
      pending.resolve({
        name: '赵六',
        phone: '13700000000',
        province: '湖北省',
        city: '武汉市',
        district: '武昌区',
        detail: '中北路 88 号',
      });
      await pending.promise;
    });

    expect(getByDisplayValue('赵六')).toBeTruthy();
    expect(getByDisplayValue('中北路 88 号')).toBeTruthy();
    expect(container.querySelector('[data-wechat-address-state="filled"]')).toBeTruthy();
    expect(mallValue.addAddress).not.toHaveBeenCalled();
  });

  it('returns quietly after cancellation and restores the button', async () => {
    requestWechatDeliveryAddressMock.mockImplementation(async (options?: WechatAddressRequestOptions) => {
      options?.onStateChange?.('returned');
      options?.onStateChange?.('cancelled');
      throw new WechatAddressRequestError('已取消获取微信地址', 'cancelled', undefined, 'openAddress:cancel');
    });
    const { container, getByRole } = renderDom(React.createElement(MPAddressPage));

    fireEvent.click(getByRole('button', { name: /从微信选择地址/ }));
    await waitFor(() => expect(container.querySelector('[data-wechat-address-state="cancelled"]')).toBeTruthy());

    expect(getByRole('button', { name: '从微信选择地址' }).hasAttribute('disabled')).toBe(false);
    expect(mallValue.showToast).not.toHaveBeenCalled();
  });

  it('restores manual entry after an unavailable or failed WeChat capability', async () => {
    requestWechatDeliveryAddressMock.mockRejectedValue(new WechatAddressRequestError(
      '当前微信版本暂不能读取地址，请手动填写',
      'unavailable',
      undefined,
      'checkJsApi:fail',
    ));
    const { container, getByLabelText, getByRole } = renderDom(React.createElement(MPAddressPage));

    fireEvent.click(getByRole('button', { name: /从微信选择地址/ }));
    await waitFor(() => expect(container.querySelector('[data-wechat-address-state="failed"]')).toBeTruthy());

    expect(getByRole('button', { name: '重新选择微信地址' }).hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(getByLabelText('整段收货地址'));
    expect(mallValue.showToast).toHaveBeenCalledWith('当前微信版本暂不能读取地址，请手动填写', 'info');
  });

  it('merges incomplete WeChat fields without erasing existing form content', async () => {
    requestWechatDeliveryAddressMock.mockRejectedValue(new WechatAddressRequestError(
      '微信地址信息不完整，请手动补充',
      'incomplete',
      { name: '', phone: '13600000000', province: '北京市', city: '北京市', district: '', detail: '' },
    ));
    const { getByDisplayValue, getByLabelText, getByRole } = renderDom(React.createElement(MPAddressPage));
    fireEvent.change(getByLabelText('收货人'), { target: { value: '原收货人' } });
    fireEvent.change(getByLabelText('详细地址'), { target: { value: '原详细地址' } });

    fireEvent.click(getByRole('button', { name: /从微信选择地址/ }));

    await waitFor(() => expect(getByDisplayValue('13600000000')).toBeTruthy());
    expect(getByDisplayValue('原收货人')).toBeTruthy();
    expect(getByDisplayValue('原详细地址')).toBeTruthy();
    expect(mallValue.showToast).toHaveBeenCalledWith('已带入微信地址，请补齐缺少内容', 'info');
  });

  it('keeps region data behind the address-page entry and removes the click-time waterfall', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/features/miniprogram/MPAddressPage.tsx'), 'utf8');
    const loaderSource = readFileSync(resolve(process.cwd(), 'src/components/mobile/miniProgramPageLoaders.ts'), 'utf8');
    const dataSource = readFileSync(resolve(process.cwd(), 'src/features/miniprogram/address/chinaRegions.ts'), 'utf8');
    const pickerSource = readFileSync(resolve(process.cwd(), 'src/features/miniprogram/address/AddressRegionPicker.tsx'), 'utf8');

    expect(loaderSource).toContain("const importMPAddressPage = () => import('../../features/miniprogram/MPAddressPage')");
    expect(loaderSource).toContain("loadMPAddressPage = () => loadPage('address', importMPAddressPage)");
    expect(pageSource).toContain("import { AddressRegionPicker } from './address/AddressRegionPicker'");
    expect(pageSource).toContain('void loadChinaRegions();');
    expect(pageSource).toContain('prepareWechatDeliveryAddress');
    expect(pageSource).not.toContain("import('../../services/wechatDeliveryAddress')");
    expect(dataSource.match(/import\('@vant\/area-data'\)/g)).toHaveLength(1);
    expect(pickerSource).toContain('requestAnimationFrame');
    expect(pickerSource).not.toContain('behavior: \'smooth\'');
    expect(pickerSource).not.toContain('88');
  });

  it('renders 44px real radios with explicit state and a visible keyboard focus style', () => {
    mallValue = createMallValue({ addresses: ADDRESS_BOOK });
    const { container, getAllByRole, queryByText } = renderDom(React.createElement(MPAddressPage));
    const radios = getAllByRole('radio');

    expect(container.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('默认收货地址');
    expect(radios).toHaveLength(2);
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true');
    expect(radios[1]?.getAttribute('aria-checked')).toBe('false');
    expect(radios[0]?.parentElement?.className).toContain('h-11 w-11');
    expect(radios[0]?.nextElementSibling?.className).toContain('peer-focus-visible:ring-2');
    expect(queryByText('设为默认')).toBeNull();
    expect(container.querySelector('[data-address-card="address:one"] svg')).toBeNull();
    expect(container.querySelector('[data-address-card="address:two"] svg')).toBeNull();
  });

  it('switches from the radio without also firing the card handler', () => {
    const setDefaultAddress = vi.fn().mockResolvedValue(true);
    mallValue = createMallValue({ addresses: ADDRESS_BOOK, setDefaultAddress });
    const { getByRole } = renderDom(React.createElement(MPAddressPage));

    fireEvent.click(getByRole('radio', { name: /李四/ }));

    expect(setDefaultAddress).toHaveBeenCalledTimes(1);
    expect(setDefaultAddress).toHaveBeenCalledWith('address:two');
  });

  it('switches from the non-default card body', () => {
    const setDefaultAddress = vi.fn().mockResolvedValue(true);
    mallValue = createMallValue({ addresses: ADDRESS_BOOK, setDefaultAddress });
    const { getByText } = renderDom(React.createElement(MPAddressPage));

    fireEvent.click(getByText(/二号/));

    expect(setDefaultAddress).toHaveBeenCalledTimes(1);
    expect(setDefaultAddress).toHaveBeenCalledWith('address:two');
  });

  it('does not turn a nested card action into a default-address click', () => {
    const setDefaultAddress = vi.fn().mockResolvedValue(true);
    mallValue = createMallValue({ addresses: ADDRESS_BOOK, setDefaultAddress });
    const { container } = renderDom(React.createElement(MPAddressPage));
    const card = container.querySelector('[data-address-card="address:two"]');
    const nestedAction = document.createElement('button');
    nestedAction.textContent = '编辑';
    card?.appendChild(nestedAction);

    fireEvent.click(nestedAction);

    expect(setDefaultAddress).not.toHaveBeenCalled();
  });

  it('shows the optimistic radio and sorted card within 100ms, then commits one default', async () => {
    const pending = deferred<DefaultResult>();
    const { container, getByRole } = renderDom(React.createElement(AddressHarness, {
      persist: () => pending.promise,
    }));

    const startedAt = performance.now();
    fireEvent.click(getByRole('radio', { name: /李四/ }));
    const feedbackMs = performance.now() - startedAt;

    expect(feedbackMs).toBeLessThan(100);
    expect(getByRole('radio', { name: /李四/ }).getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('[data-address-card]')?.getAttribute('data-address-card')).toBe('address:two');
    expect(container.querySelectorAll('input[aria-checked="true"]')).toHaveLength(1);

    await act(async () => {
      pending.resolve({ id: 'address:two', isDefault: true, version: 5 });
      await pending.promise;
    });

    expect(container.querySelector('[data-address-card]')?.getAttribute('data-address-card')).toBe('address:two');
    expect(container.querySelectorAll('input[aria-checked="true"]')).toHaveLength(1);
  });

  it('restores the original radio and order when the service rejects the change', async () => {
    const pending = deferred<DefaultResult>();
    const { container, getByRole } = renderDom(React.createElement(AddressHarness, {
      persist: () => pending.promise,
    }));

    fireEvent.click(getByRole('radio', { name: /李四/ }));
    expect(getByRole('radio', { name: /李四/ }).getAttribute('aria-checked')).toBe('true');

    await act(async () => {
      pending.reject(new Error('network'));
      await pending.promise.catch(() => undefined);
    });

    expect(getByRole('radio', { name: /张三/ }).getAttribute('aria-checked')).toBe('true');
    expect(getByRole('radio', { name: /李四/ }).getAttribute('aria-checked')).toBe('false');
    expect(container.querySelector('[data-address-card]')?.getAttribute('data-address-card')).toBe('address:one');
  });

  it('supports arrow, Space and Enter keyboard selection', async () => {
    const persist = vi.fn(async (address: DeliveryAddress): Promise<DefaultResult> => ({
      id: address.id,
      isDefault: true,
      version: (address.version ?? 0) + 1,
    }));
    const { getByRole } = renderDom(React.createElement(AddressHarness, { persist }));
    const firstRadio = getByRole('radio', { name: /张三/ });

    firstRadio.focus();
    fireEvent.keyDown(firstRadio, { key: 'ArrowDown' });
    await act(async () => undefined);
    expect(getByRole('radio', { name: /李四/ }).getAttribute('aria-checked')).toBe('true');

    fireEvent.keyDown(getByRole('radio', { name: /张三/ }), { key: ' ' });
    await act(async () => undefined);
    expect(getByRole('radio', { name: /张三/ }).getAttribute('aria-checked')).toBe('true');

    fireEvent.keyDown(getByRole('radio', { name: /李四/ }), { key: 'Enter' });
    await act(async () => undefined);
    expect(getByRole('radio', { name: /李四/ }).getAttribute('aria-checked')).toBe('true');
    expect(persist).toHaveBeenCalledTimes(3);
  });

  it('reads the persisted default flag again after a refresh or new login', () => {
    mallValue = createMallValue({ addresses: [{ ...ADDRESS_BOOK[0], isDefault: false }, { ...ADDRESS_BOOK[1], isDefault: true }] });
    const { container, getByRole, rerender } = renderDom(React.createElement(MPAddressPage));

    expect(container.querySelector('[data-address-card]')?.getAttribute('data-address-card')).toBe('address:two');
    expect(getByRole('radio', { name: /李四/ }).getAttribute('aria-checked')).toBe('true');

    mallValue = createMallValue({ addresses: ADDRESS_BOOK });
    rerender(React.createElement(MPAddressPage));
    expect(container.querySelector('[data-address-card]')?.getAttribute('data-address-card')).toBe('address:one');
    expect(getByRole('radio', { name: /张三/ }).getAttribute('aria-checked')).toBe('true');
  });
});
