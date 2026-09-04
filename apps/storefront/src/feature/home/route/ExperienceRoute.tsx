import { Navigate, useLocation } from 'react-router';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { experiencePage } from '../../../entity/session/model/PublishedExperience';
import { ROUTES } from '../../../generated/RouteBinding';
import { HomePage } from '../view/HomePage';
import { useHomeViewModel } from '../viewmodel/HomeViewModel';

export function Component() {
  const session = useSession();
  const location = useLocation();
  const viewmodel = useHomeViewModel();
  const page = experiencePage(session.experience, location.pathname);
  return page ? <HomePage viewmodel={viewmodel} page={page} /> : <Navigate replace to={ROUTES.storehome} />;
}
