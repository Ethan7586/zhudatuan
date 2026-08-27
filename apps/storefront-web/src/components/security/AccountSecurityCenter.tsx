import React, { useEffect, useState } from 'react';
import { KeyRound, Laptop, Loader2, LockKeyhole, Phone, ShieldCheck, Smartphone, X } from 'lucide-react';
import { productionApi, ProductionApiError, type ApiSecurityCenter } from '../../services/productionApi';

export const AccountSecurityCenter: React.FC<{ onSignedOut: () => void; onSecurityChanged?: () => Promise<void> | void }> = ({ onSignedOut, onSecurityChanged }) => {
  const [data, setData] = useState<ApiSecurityCenter | null>(null),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState('');
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [phone, setPhone] = useState({ mobile: '', code: '', challengeId: '', currentPassword: '' });
  const load = async (clearMessage = true) => {
    setLoading(true);
    try {
      setData(await productionApi.getSecurityCenter());
      if (clearMessage) setMessage('');
    } catch (error) {
      setMessage(apiMessage(error));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const changePassword = async () => {
    if (passwords.next !== passwords.confirm) return setMessage('两次输入的新密码不一致');
    setLoading(true);
    try {
      await productionApi.changePassword({ currentPassword: passwords.current, newPassword: passwords.next });
      setPasswords({ current: '', next: '', confirm: '' });
      setMessage('密码已更新，其他设备已强制下线');
      await load(false);
    } catch (error) {
      setMessage(apiMessage(error));
    } finally {
      setLoading(false);
    }
  };
  const sendPhoneCode = async () => {
    setLoading(true);
    try {
      const result = await productionApi.requestSecurityOtp({ mobile: phone.mobile, purpose: 'phone_change' });
      setPhone((current) => ({ ...current, challengeId: result.challengeId, code: result.debugCode ?? current.code }));
      setMessage(result.debugCode ? `开发环境验证码：${result.debugCode}` : '验证码已发送');
    } catch (error) {
      setMessage(apiMessage(error));
    } finally {
      setLoading(false);
    }
  };
  const changePhone = async () => {
    setLoading(true);
    try {
      await productionApi.changePhone({ newMobile: phone.mobile, challengeId: phone.challengeId, code: phone.code, currentPassword: phone.currentPassword });
      setPhone({ mobile: '', code: '', challengeId: '', currentPassword: '' });
      setMessage(data?.phoneVerified ? '手机号已更换，其他设备已强制下线' : '手机认证已完成，订单与支付功能已经解锁');
      await load(false);
      await onSecurityChanged?.();
    } catch (error) {
      setMessage(apiMessage(error));
    } finally {
      setLoading(false);
    }
  };
  const revoke = async (id: string, current: boolean) => {
    setLoading(true);
    try {
      await productionApi.revokeSession(id);
      if (current) {
        onSignedOut();
        return;
      }
      setMessage('该设备已下线');
      await load(false);
    } catch (error) {
      setMessage(apiMessage(error));
    } finally {
      setLoading(false);
    }
  };
  if (loading && !data)
    return (
      <div className="flex items-center gap-2 rounded-md border bg-white p-5 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在读取安全状态...
      </div>
    );
  return (
    <section className="space-y-4 rounded-md border border-gray-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-950">
            <ShieldCheck className="h-5 w-5 text-[var(--sw-brand)]" />
            账号与会员安全中心
          </h2>
          <p className="mt-1 text-[11px] text-gray-500">密码、手机号和登录设备均由服务端实时保护</p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[var(--sw-brand)]" />}
      </div>
      {message && <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">{message}</p>}
      {data && (
        <div className={`rounded-md border p-4 ${data.phoneVerified ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className={`text-sm font-bold ${data.phoneVerified ? 'text-emerald-900' : 'text-amber-900'}`}>{data.phoneVerified ? '手机认证已完成' : '基础会员 · 手机待验证'}</div>
              <p className={`mt-1 text-xs leading-5 ${data.phoneVerified ? 'text-emerald-700' : 'text-amber-800'}`}>
                {data.phoneVerified ? '账号与手机双重认证有效，当前可以提交订单并使用支付功能。' : '账号密码已经认证，可登录、浏览和管理购物车；提交订单和付款将在短信验证完成后解锁。'}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${data.phoneVerified ? 'bg-emerald-600 text-white' : 'bg-amber-200 text-amber-900'}`}>{data.phoneVerified ? '认证等级：手机' : '认证等级：账号'}</span>
          </div>
        </div>
      )}
      {!data?.hasLocalCredential && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">当前为企业测试身份，尚未建立本地密码；安全中心只开放设备管理。</p>}
      {data?.hasLocalCredential && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SecurityCard icon={<LockKeyhole className="h-5 w-5" />} title="修改密码" subtitle={`上次修改：${formatDate(data.passwordChangedAt)}`}>
            <PasswordInput label="当前密码" value={passwords.current} onChange={(current) => setPasswords({ ...passwords, current })} />
            <PasswordInput label="新密码" value={passwords.next} onChange={(next) => setPasswords({ ...passwords, next })} />
            <PasswordInput label="确认新密码" value={passwords.confirm} onChange={(confirm) => setPasswords({ ...passwords, confirm })} />
            <ActionButton disabled={loading} onClick={changePassword}>
              更新密码并下线其他设备
            </ActionButton>
          </SecurityCard>
          <SecurityCard icon={<Phone className="h-5 w-5" />} title={data.phoneVerified ? '更换已验证手机号' : '验证并绑定手机号'} subtitle={`当前状态：${data.phoneVerified ? (data.phoneMasked ?? '已验证') : '未验证'}`}>
            {!data.phoneVerificationAvailable && (
              <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">短信通道尚未开通。当前保留绑定入口，但不会发送模拟验证码；通道开通后可直接在这里完成认证。</p>
            )}
            <Field label={data.phoneVerified ? '新手机号' : '手机号'} value={phone.mobile} onChange={(mobile) => setPhone({ ...phone, mobile })} />
            <div className="flex gap-2">
              <Field label="验证码" value={phone.code} onChange={(code) => setPhone({ ...phone, code })} />
              <button
                onClick={sendPhoneCode}
                disabled={loading || !data.phoneVerificationAvailable}
                className="mt-5 shrink-0 rounded border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-[var(--sw-brand)] disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
              >
                获取验证码
              </button>
            </div>
            <PasswordInput label="当前密码" value={phone.currentPassword} onChange={(currentPassword) => setPhone({ ...phone, currentPassword })} />
            <ActionButton disabled={loading || !phone.challengeId} onClick={changePhone}>
              {data.phoneVerified ? '确认更换手机号' : '完成手机认证'}
            </ActionButton>
          </SecurityCard>
        </div>
      )}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <Laptop className="h-4 w-4 text-[var(--sw-brand)]" />
            登录设备
          </h3>
          <button
            onClick={async () => {
              setLoading(true);
              try {
                const result = await productionApi.revokeOtherSessions();
                setMessage(`已下线其他 ${result.revokedCount} 个会话`);
                await load(false);
              } catch (error) {
                setMessage(apiMessage(error));
              } finally {
                setLoading(false);
              }
            }}
            className="text-xs font-bold text-rose-600 hover:underline"
          >
            下线其他全部设备
          </button>
        </div>
        <div className="divide-y rounded-md border">
          {data?.sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between gap-3 p-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-50 p-2 text-[var(--sw-brand)]">{session.deviceLabel.includes('Android') || session.deviceLabel.includes('iOS') ? <Smartphone className="h-4 w-4" /> : <Laptop className="h-4 w-4" />}</div>
                <div>
                  <div className="font-bold text-gray-900">
                    {session.deviceLabel}
                    {session.current && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">当前设备</span>}
                  </div>
                  <div className="mt-1 text-[10px] text-gray-400">
                    最近活动 {formatDate(session.lastSeenAt)} · {session.target === 'admin' ? '管理后台' : '员工商城'}
                  </div>
                </div>
              </div>
              <button onClick={() => revoke(session.id, session.current)} className="rounded p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600" title="强制下线">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const SecurityCard: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }> = ({ icon, title, subtitle, children }) => (
  <div className="space-y-3 rounded-md border border-gray-200 p-4">
    <div className="flex items-center gap-2 text-[var(--sw-brand)]">
      {icon}
      <div>
        <div className="text-sm font-bold text-gray-900">{title}</div>
        <div className="text-[10px] text-gray-400">{subtitle}</div>
      </div>
    </div>
    {children}
  </div>
);
const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <label className="block flex-1 text-[11px] font-medium text-gray-600">
    {label}
    <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[var(--sw-brand)]" />
  </label>
);
const PasswordInput: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <label className="block text-[11px] font-medium text-gray-600">
    {label}
    <input type="password" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[var(--sw-brand)]" />
  </label>
);
const ActionButton: React.FC<{ disabled: boolean; onClick: () => void; children: React.ReactNode }> = ({ disabled, onClick, children }) => (
  <button type="button" disabled={disabled} onClick={onClick} className="flex w-full items-center justify-center gap-2 rounded bg-[var(--sw-brand)] px-3 py-2 text-xs font-bold text-white disabled:bg-gray-300">
    <KeyRound className="h-3.5 w-3.5" />
    {children}
  </button>
);
function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '暂无记录';
}
function apiMessage(error: unknown) {
  return error instanceof ProductionApiError ? error.message : '安全服务暂时不可用';
}
