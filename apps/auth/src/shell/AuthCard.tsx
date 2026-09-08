import { Button } from '@shop/design';
import { Brand } from '@shop/design/atom/Brand';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';

export function AuthCard({
  stage,
  flow = 'login',
  onBack,
  children,
}: React.PropsWithChildren<
  Readonly<{
    stage: 1 | 2;
    flow?: 'login' | 'registration';
    onBack: () => void;
  }>
>) {
  return (
    <div className="authcardframe">
      <div className="authcardlayout" data-stage={stage}>
        <aside className="authbrand">
          <div className="authbrandambient" />
          <div className="authbrandhead">
            <Brand variant="mark" product="Enterprise Benefits" inverse />
          </div>
          <div className="authbrandcopy">
            <h1>
              企业福利
              <br />
              全新定义
            </h1>
            <p className="authbranddescription">连接员工与企业的智慧桥梁，提供更有温度的数字福利体验。</p>
          </div>
          <ul className="authbrandbenefits" aria-label="智慧翼福利体验">
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
        </aside>
        <div className="authsurfaceframe">
          <div className="authsurface">
            <div className="authsurfacehead">
              {flow === 'registration' ? (
                <div className="authflowlabel">
                  <ShieldCheck aria-hidden="true" />
                  <span>安全邀请注册</span>
                </div>
              ) : (
                <div className="authsteps" aria-label={`认证进度：第 ${stage} 步，共 2 步`}>
                  {stage === 2 && (
                    <Button tone="quiet" onPress={onBack} className="authback" aria-label="返回上一阶段">
                      <ArrowLeft aria-hidden="true" />
                    </Button>
                  )}
                  <span className="authstep" data-current={stage === 1}>
                    {stage === 2 ? <CheckCircle2 aria-label="账号认证已完成" /> : '1'}
                  </span>
                  <span className="authstepbar" data-complete={stage === 2} />
                  <span className="authstep" data-current={stage === 2}>
                    2
                  </span>
                </div>
              )}
              <div className="authsurfacelabel">
                <Brand variant="mark" />
                <span>{flow === 'registration' ? '新用户注册' : stage === 1 ? '账号认证' : '选择进入方式'}</span>
              </div>
            </div>
            <div className="authsurfacebody">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
