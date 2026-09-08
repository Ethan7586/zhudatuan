export class PrivacyBridge {
  private authorized = false;

  async ensure(): Promise<void> {
    if (this.authorized) return;
    const needed = await privacyNeeded();
    if (needed) await requestAuthorization();
    this.authorized = true;
  }
}

function privacyNeeded(): Promise<boolean> {
  if (wx.getPrivacySetting === undefined) return Promise.resolve(false);
  return new Promise((resolve, reject) => wx.getPrivacySetting!({ success: ({ needAuthorization }) => resolve(needAuthorization), fail: reject }));
}

function requestAuthorization(): Promise<void> {
  if (wx.requirePrivacyAuthorize === undefined) return Promise.reject(new Error('MINIAPP_PRIVACY_AUTHORIZATION_UNAVAILABLE'));
  return new Promise((resolve, reject) => wx.requirePrivacyAuthorize!({ success: resolve, fail: reject }));
}
