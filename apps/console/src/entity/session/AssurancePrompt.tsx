import { useStepup } from './StepupContext';
import './AssurancePrompt.css';

export function AssurancePrompt({ title, description }: Readonly<{ title: string; description?: string }>) {
  const stepup = useStepup();
  return (
    <section className="assuranceprompt" aria-labelledby="assuranceprompt-title">
      <div className="assuranceprompticon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 4 5v6c0 5.2 3.3 9.3 8 11 4.7-1.7 8-5.8 8-11V5z" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </svg>
      </div>
      <div className="assurancepromptcopy">
        <p className="eyebrow">敏感数据保护</p>
        <h1 id="assuranceprompt-title">{title}</h1>
        <p>{description ?? '为保护企业数据，请先完成短信二次验证。验证成功后将自动返回并加载当前页面。'}</p>
        <ul aria-label="验证说明">
          <li>验证码仅用于确认本次操作人身份</li>
          <li>验证状态由服务端签发，页面不会保存验证码</li>
          <li>完成后继续使用当前数据范围，无需重新登录</li>
        </ul>
        <button className="shopbutton assurancepromptbutton" type="button" onClick={stepup.request}>
          立即完成二次验证
        </button>
      </div>
    </section>
  );
}
