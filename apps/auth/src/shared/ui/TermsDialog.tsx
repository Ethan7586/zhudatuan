import { FileText, X } from 'lucide-react';
import { CANONICAL_CONSOLE_ORIGIN, CANONICAL_STOREFRONT_ORIGIN } from '@shop/config/client';

export function TermsDialog({
  kind,
  onAccept,
  onClose,
}: Readonly<{
  kind: 'terms' | 'privacy';
  onAccept: () => void;
  onClose: () => void;
}>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="terms-title">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
          <div id="terms-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
            <FileText className="h-5 w-5 text-[var(--sw-brand)]" />
            {kind === 'terms' ? '智慧翼企业福利商城 - 用户服务协议' : '智慧翼企业福利商城 - 隐私保护政策'}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600" aria-label="关闭协议">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-2 text-xs leading-relaxed text-slate-600">
          <p className="font-semibold text-slate-800">一、服务说明与主体定义</p>
          <p>
            本《统一身份与登录服务协议》适用于筑大团消费者商城（{new URL(CANONICAL_STOREFRONT_ORIGIN).hostname}）与运营后台（{new URL(CANONICAL_CONSOLE_ORIGIN).hostname}
            ）。技术服务由雍彻科技提供安全合规与鉴权支持；其他域名不属于本系统的登录或会话边界。
          </p>
          <p className="font-semibold text-slate-800">二、安全与凭证红线</p>
          <p>本系统由服务端建立可撤销的 Host-only HttpOnly 会话。前端不落地存储密码、永久 Token 或跨域票据。高风险管理操作须经正式二次验证；连续失败认证会被限流并记入安全审计。</p>
          <p className="font-semibold text-slate-800">三、个人信息保护</p>
          <p>我们遵循最小必要原则处理手机号码、企业工号与角色授权信息，仅用于福利服务、安全验证与审计。</p>
        </div>
        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button type="button" onClick={onAccept} className="rounded-xl bg-[var(--sw-brand)] px-5 py-2 text-xs font-semibold text-white hover:bg-[var(--sw-brand-dark)]">
            我已阅读并同意
          </button>
        </div>
      </div>
    </div>
  );
}
