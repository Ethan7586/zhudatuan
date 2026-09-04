import { useNavigate } from 'react-router';
import { ROUTES } from '../../../generated/RouteBinding';
import { useDependencies } from '../../../app/DependencyContext';
import { Guard } from '../../../route/Guard';
import { InvalidRoute } from '../../../route/RouteError';
import { MembershipPage } from '../view/MembershipPage';
import { useMembershipViewModel } from '../viewmodel/MembershipViewModel';

export function Component() {
  const dependencies = useDependencies();
  const navigate = useNavigate();
  return (
    <Guard route={ROUTES.authmembership} rejected={<InvalidRoute />}>
      {(request) => <MembershipView dependencies={dependencies} session={request} onRestart={() => void navigate(ROUTES.authlogin, { replace: true })} />}
    </Guard>
  );
}

function MembershipView({ dependencies, session, onRestart }: Readonly<{ dependencies: ReturnType<typeof useDependencies>; session: Parameters<typeof useMembershipViewModel>[1]; onRestart: () => void }>) {
  const vm = useMembershipViewModel(dependencies, session);
  return <MembershipPage memberships={vm.memberships} busy={vm.busy} {...(vm.failure === undefined ? {} : { failure: vm.failure })} onSelect={vm.select} onRestart={onRestart} />;
}
