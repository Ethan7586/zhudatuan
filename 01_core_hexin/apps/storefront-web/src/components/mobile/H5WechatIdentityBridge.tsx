import { useEffect, useRef } from 'react';
import { useMall } from '../../context/MallContext';
import { productionApi, ProductionApiError } from '../../services/productionApi';
import {
  beginH5WechatAuthorization,
  bindH5WechatIdentity,
  completeH5WechatSession,
  exchangeH5WechatCode,
  requestH5WechatAuthorization,
  type H5WechatAuthorization,
} from '../../services/h5WechatIdentity';

const AUTHORIZATION_KEY = 'zdt.h5.wechat.authorization';
const BINDING_KEY = 'zdt.h5.wechat.binding';
const BOUND_USER_KEY = 'zdt.h5.wechat.bound-user';
const ATTEMPT_KEY = 'zdt.h5.wechat.attempted';

export function H5WechatIdentityBridge() {
  const { sessionStatus, user, showToast } = useMall();
  const running = useRef(false);

  useEffect(() => {
    if (running.current || !isWechatBrowser() || sessionStatus === 'checking') return;
    running.current = true;

    const run = async () => {
      const incoming = new URL(window.location.href);
      const code = incoming.pathname === '/wechat/callback' ? incoming.searchParams.get('code') : null;
      const state = incoming.pathname === '/wechat/callback' ? incoming.searchParams.get('state') : null;
      const authorization = readAuthorization();

      if (code) {
        if (!authorization || state !== authorization.request.state) throw new Error('微信登录状态已失效，请重新打开商城');
        const exchanged = await exchangeH5WechatCode(code, authorization);
        sessionStorage.removeItem(AUTHORIZATION_KEY);
        sessionStorage.removeItem(ATTEMPT_KEY);
        if (exchanged.kind === 'authenticated') {
          await completeH5WechatSession(exchanged.callback, authorization);
          localStorage.setItem(BOUND_USER_KEY, 'wechat');
          window.location.replace('/');
          return;
        }
        sessionStorage.setItem(BINDING_KEY, exchanged.bindingToken);
        window.history.replaceState({}, '', '/');
        if (sessionStatus === 'authenticated') {
          await productionApi.getSession();
          await bindH5WechatIdentity(exchanged.bindingToken);
          sessionStorage.removeItem(BINDING_KEY);
          localStorage.setItem(BOUND_USER_KEY, user.id);
          window.location.replace('/');
          return;
        }
        showToast('微信已识别，登录一次即可完成绑定', 'info');
        return;
      }

      const pendingBinding = sessionStorage.getItem(BINDING_KEY);
      if (pendingBinding && sessionStatus === 'authenticated') {
        await bindH5WechatIdentity(pendingBinding);
        sessionStorage.removeItem(BINDING_KEY);
        localStorage.setItem(BOUND_USER_KEY, user.id);
        showToast('微信绑定成功，以后可直接从微信进入商城', 'success');
        return;
      }

      if (sessionStatus === 'authenticated' && localStorage.getItem(BOUND_USER_KEY) === user.id) return;
      if (sessionStorage.getItem(ATTEMPT_KEY) === 'yes') return;
      const next = await beginH5WechatAuthorization();
      sessionStorage.setItem(AUTHORIZATION_KEY, JSON.stringify(next));
      sessionStorage.setItem(ATTEMPT_KEY, 'yes');
      window.location.assign(await requestH5WechatAuthorization(next));
    };

    void run().catch((cause) => {
      sessionStorage.removeItem(ATTEMPT_KEY);
      const message = cause instanceof ProductionApiError || cause instanceof Error ? cause.message : '微信登录暂时不可用';
      showToast(message, 'error');
      running.current = false;
    });
  }, [sessionStatus, showToast, user.id]);

  return null;
}

function isWechatBrowser(): boolean {
  return typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent);
}

function readAuthorization(): H5WechatAuthorization | null {
  const source = sessionStorage.getItem(AUTHORIZATION_KEY);
  if (!source) return null;
  try {
    const value = JSON.parse(source) as H5WechatAuthorization;
    const tokens = [value.request.state, value.request.nonce, value.request.challenge, value.secret.nonce, value.secret.verifier];
    return tokens.every((token) => typeof token === 'string' && token.length >= 32) ? value : null;
  } catch {
    return null;
  }
}
