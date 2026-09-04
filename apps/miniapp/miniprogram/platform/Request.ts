import type { WechatRequester } from '@shop/sdk';
import { CookieJar } from './CookieJar';

export function createWechatRequester(origin: string, cookies: CookieJar): WechatRequester {
  return (request) =>
    wx.request({
      ...request,
      header: Object.freeze({
        ...request.header,
        origin,
        ...(cookies.header() === undefined ? {} : { cookie: cookies.header()! }),
      }),
      success: (response) => {
        cookies.capture(response.header);
        request.success(response);
      },
      fail: request.fail,
    });
}

export function wechatLogin(): Promise<string> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: ({ code }) => (/^[A-Za-z0-9._~-]{8,512}$/.test(code) ? resolve(code) : reject(new Error('MINIAPP_LOGIN_CODE_INVALID'))),
      fail: reject,
    });
  });
}
