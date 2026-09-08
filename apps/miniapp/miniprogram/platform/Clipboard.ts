export function copyText(value: string): Promise<void> {
  if (value.length === 0 || value.length > 4096) return Promise.reject(new Error('MINIAPP_CLIPBOARD_VALUE_INVALID'));
  return new Promise((resolve, reject) => wx.setClipboardData({ data: value, success: resolve, fail: reject }));
}
