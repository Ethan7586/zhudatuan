import { useParams } from 'react-router';
import { ConversationPage } from '../view/ConversationPage';
import { useConversationViewModel } from '../viewmodel/ConversationViewModel';
export function Component() {
  const { caseId = '' } = useParams();
  return <ConversationPage viewmodel={useConversationViewModel(caseId)} />;
}
