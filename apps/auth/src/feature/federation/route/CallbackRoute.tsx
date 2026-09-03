import { useNavigate } from 'react-router';
import { ROUTES } from '../../../generated/RouteBinding';
import { Guard } from '../../../route/Guard';
import { InvalidRoute } from '../../../route/RouteError';
import { CallbackPage } from '../view/CallbackPage';

export function Component() {
  const navigate = useNavigate();
  return <Guard route={ROUTES.authcallback} rejected={<InvalidRoute />}>{() => <CallbackPage onBack={() => navigate(ROUTES.authlogin, { replace: true })} />}</Guard>;
}
