import { useLocation, useNavigate } from 'react-router';
import { ROUTES } from '../../../generated/RouteBinding';
import { Guard } from '../../../route/Guard';
import { InvalidRoute } from '../../../route/RouteError';
import { LinkPage } from '../view/LinkPage';
import { useDependencies } from '../../../app/DependencyContext';
import { useLinkViewModel } from '../viewmodel/LinkViewModel';

export function Component() {
  const navigate = useNavigate();
  const location = useLocation();
  const dependencies = useDependencies();
  const conflict = new URLSearchParams(location.search).get('code') === 'FEDERATION_LINK_REQUIRED';
  return (
    <Guard route={ROUTES.authlink} rejected={<InvalidRoute />}>
      {(request) => <LinkRouteView session={request} conflict={conflict} dependencies={dependencies} onBack={() => void navigate(ROUTES.authlogin, { replace: true })} />}
    </Guard>
  );
}

function LinkRouteView({ session, conflict, dependencies, onBack }: Readonly<{ session: Parameters<typeof useLinkViewModel>[1]; conflict: boolean; dependencies: ReturnType<typeof useDependencies>; onBack: () => void }>) {
  return <LinkPage viewmodel={useLinkViewModel(dependencies, session, conflict)} onBack={onBack} />;
}
