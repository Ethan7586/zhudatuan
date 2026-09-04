import { useHomeViewModel } from '../viewmodel/HomeViewModel';
import { HomePage } from '../view/HomePage';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { experiencePage } from '../../../entity/session/model/PublishedExperience';
export function Component() {
  const session = useSession();
  const viewmodel = useHomeViewModel();
  const page = experiencePage(session.experience, '/');
  return <HomePage viewmodel={viewmodel} {...(page ? { page } : {})} />;
}
