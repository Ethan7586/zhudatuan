import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useStepup } from '../../../entity/session/StepupContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { ChannelPage } from '../view/ChannelPage';
import { useChannelViewModel } from '../viewmodel/ChannelViewModel';
import '../view/Channel.css';

export function Component() { const context = useConsoleContext(); const dependencies = useDependencies(); const stepup = useStepup(); return <ChannelPage title={useRouteTitle('渠道管理')} model={useChannelViewModel(context, dependencies.channel, stepup.request)} />; }
