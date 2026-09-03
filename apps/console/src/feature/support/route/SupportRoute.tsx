import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { SupportPage } from '../view/SupportPage';
import { useSupportViewModel } from '../viewmodel/SupportViewModel';
import '../view/SupportLayout.css';
import '../view/SupportConversation.css';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  return <SupportPage model={useSupportViewModel(context, dependencies.support)} />;
}
