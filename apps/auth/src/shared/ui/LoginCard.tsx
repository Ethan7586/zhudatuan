import { Brand } from '@shop/design';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export function LoginCard({
  stage,
  onBack,
  children,
}: React.PropsWithChildren<
  Readonly<{
    stage: 1 | 2;
    onBack: () => void;
  }>
>) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-x-hidden p-4 sm:p-6 lg:p-4">
      <div
        className={`relative grid w-full ${stage === 2 ? 'max-w-[1120px] lg:grid-cols-[360px_minmax(0,1fr)]' : 'max-w-[1040px] lg:grid-cols-[minmax(0,1fr)_500px]'} overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--sw-brand)] to-[var(--sw-brand-dark)] shadow-xl`}
      >
        <div className={`min-h-[260px] p-8 text-white sm:p-10 lg:min-h-[670px] lg:p-12`}>
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex items-center gap-3">
            <Brand variant="mark" product="Enterprise Benefits" inverse />
          </div>
          <div className="relative z-10 my-8">
            <h1 className="text-4xl font-black leading-tight tracking-tighter text-white opacity-95 sm:text-5xl">
              企业福利
              <br />
              全新定义
            </h1>
            <p className="authbranddescription mt-4 max-w-[320px] text-sm leading-relaxed sm:text-base">连接员工与企业的智慧桥梁，提供更有温度的数字福利体验。</p>
          </div>
          <ul className="authbrandbenefits relative z-10 space-y-3 border-t border-white/20 pt-7" aria-label="智慧翼福利体验">
            <li>
              <span aria-hidden="true">✓</span>企业专属福利，一站式领取与选购
            </li>
            <li>
              <span aria-hidden="true">✓</span>统一账号认证，商城与控制台清晰分流
            </li>
            <li>
              <span aria-hidden="true">✓</span>权限隔离与安全验证，守护每次访问
            </li>
          </ul>
        </div>
        <div className="relative z-10 flex items-center bg-slate-50/10 p-4 sm:p-6">
          <div className="w-full overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl shadow-slate-900/15 transition-all duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-white via-slate-50 to-blue-50/70 px-6 py-4 sm:px-8">
              <div className="flex items-center gap-2.5">
                {stage === 2 && (
                  <button type="button" onClick={onBack} className="mr-0.5 rounded-xl p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-800" aria-label="返回上一阶段">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${stage === 2 ? 'bg-blue-100 text-[var(--sw-brand)]' : 'bg-[var(--sw-brand)] text-white shadow-md shadow-blue-500/25'}`}>
                  {stage === 2 ? <CheckCircle2 className="h-3.5 w-3.5" /> : '1'}
                </div>
                <div className={`h-[2px] w-5 sm:w-7 ${stage === 2 ? 'bg-[var(--sw-brand)]' : 'bg-slate-200'}`} />
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${stage === 2 ? 'bg-[var(--sw-brand)] text-white shadow-md shadow-blue-500/25' : 'border-2 border-slate-200 bg-white text-slate-400'}`}
                >
                  2
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Brand variant="mark" />
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{stage === 1 ? '账号认证' : '选择进入方式'}</span>
              </div>
            </div>
            <div className="p-5 sm:p-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
