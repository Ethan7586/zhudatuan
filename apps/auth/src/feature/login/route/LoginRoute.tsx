import { useLocation, useNavigate } from 'react-router';
import { useDependencies } from '../../../app/DependencyContext';
import { AuthRuntime } from '../../../app/AuthRuntime';
import { Guard } from '../../../route/Guard';
import { ROUTES } from '../../../generated/RouteBinding';
import { authTargetSearch } from '../../../shared/security/ReturnTarget';
import { InvalidRoute } from '../../../route/RouteError';

export function Component() {
  const dependencies = useDependencies();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Guard route={ROUTES.authlogin} rejected={<InvalidRoute />}>
      {(request) => <AuthRuntime dependencies={dependencies} request={request} invitation={false} onTarget={(target) => void navigate({ pathname: location.pathname, search: authTargetSearch(location.search, target) }, { replace: true })} />}
    </Guard>
  );
}
