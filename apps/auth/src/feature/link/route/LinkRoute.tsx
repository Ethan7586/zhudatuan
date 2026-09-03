import { useNavigate } from 'react-router';
import { ROUTES } from '../../../generated/RouteBinding';
import { Guard } from '../../../route/Guard';
import { InvalidRoute } from '../../../route/RouteError';
import { LinkPage } from '../view/LinkPage';
import { useDependencies } from '../../../app/DependencyContext';
import { useLinkViewModel } from '../viewmodel/LinkViewModel';

export function Component() {
  const navigate = useNavigate();
  const dependencies = useDependencies();
  return <Guard route={ROUTES.authlink} rejected={<InvalidRoute />}>{(request) => <LinkRouteView target={request.target} dependencies={dependencies} onBack={() => navigate(ROUTES.authlogin, { replace: true })} />}</Guard>;
}

function LinkRouteView({ target, dependencies, onBack }: Readonly<{ target: Parameters<typeof useLinkViewModel>[1]; dependencies: ReturnType<typeof useDependencies>; onBack: () => void }>) {
  return <LinkPage state={useLinkViewModel(dependencies.link, target)} onBack={onBack} />;
}
