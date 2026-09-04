import { Link } from 'react-router';
import { ROUTES } from '../generated/RouteBinding';
import { AuthCard } from '../shell/AuthCard';
import { AuthShell } from '../shell/AuthShell';

export function InvalidRoute() {
  return <Frame title="链接不可用" detail="该登录链接不完整、重复或包含不受支持的参数。" />;
}
export function NotFound() {
  return <Frame title="页面不存在" detail="请从统一登录入口重新开始。" />;
}
function Frame({ title, detail }: Readonly<{ title: string; detail: string }>) {
  return (
    <AuthShell>
      <AuthCard stage={1} onBack={() => undefined}>
        <section className="authstatus">
          <h1>{title}</h1>
          <p>{detail}</p>
          <Link className="shopbutton shopbuttonprimary authfull" to={ROUTES.authlogin} replace>
            返回安全登录
          </Link>
        </section>
      </AuthCard>
    </AuthShell>
  );
}
