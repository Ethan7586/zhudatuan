import type { SupportViewModel } from '../viewmodel/SupportViewModel';
import { HistoryPanel } from './HistoryPanel';
import { SupportContextPanel } from './SupportContextPanel';
import { SupportConversation } from './SupportConversation';
import { SupportHeader } from './SupportHeader';
import { SupportQueue } from './SupportQueue';
import { SupportSettings } from './SupportSettings';

export function SupportPage({ model }: Readonly<{ model: SupportViewModel }>) {
  const conversation = model.conversation;
  return (
    <section className="supportworkspace">
      <SupportHeader scope={model.scope} settings={model.settingsOpen} settingsAvailable={model.access.settings} connected={model.connected} realtime={model.access.realtime} onRefresh={model.actions.refresh} onSettings={model.actions.settings} />
      {model.settingsOpen ? (
        <SupportSettings model={model.settings} />
      ) : (
        <>
          <div className="supportdesk" data-selected={model.ticket ? 'true' : 'false'} data-connected={model.connected}>
            <SupportQueue
              tickets={model.tickets}
              filter={model.filter}
              {...(model.selected ? { selected: model.selected } : {})}
              condition={model.queueCondition}
              {...(model.queueError ? { error: model.queueError } : {})}
              {...(model.queueNextCursor ? { nextCursor: model.queueNextCursor } : {})}
              onFilter={model.actions.filter}
              onNext={model.actions.next}
              onRetry={model.actions.retryQueue}
              onSelect={model.actions.select}
            />
            <SupportConversation
              {...(model.ticket ? { ticket: model.ticket } : {})}
              messages={conversation.messages}
              condition={conversation.condition}
              {...(conversation.error ? { error: conversation.error } : {})}
              {...(conversation.nextCursor ? { nextCursor: conversation.nextCursor } : {})}
              draft={conversation.draft}
              unavailable={conversation.unavailable}
              sending={conversation.sending}
              {...(conversation.pending ? { pending: conversation.pending } : {})}
              {...(conversation.failed ? { failed: conversation.failed } : {})}
              messageAttachments={conversation.messageAttachments}
              uploads={conversation.uploads}
              attachmentAllowed={conversation.attachmentAllowed}
              onDraft={conversation.actions.draft}
              onSend={conversation.actions.send}
              onRetrySend={conversation.actions.retrySend}
              onFile={conversation.actions.file}
              onEarlier={conversation.actions.earlier}
              onRetry={conversation.actions.refresh}
              onRead={conversation.actions.read}
              onContext={model.actions.openContext}
              onBack={model.actions.back}
            />
            <SupportContextPanel
              open={model.contextOpen}
              {...(model.ticket ? { ticket: model.ticket } : {})}
              {...(conversation.context ? { context: conversation.context } : {})}
              agents={model.agents}
              busy={model.actionBusy}
              {...(model.actionError ? { error: model.actionError } : {})}
              onDismiss={model.actions.closeContext}
              onClose={model.actions.closeTicket}
              onReopen={model.actions.reopenTicket}
              onAssign={model.actions.assign}
              onHistory={model.actions.openHistory}
              canAssign={model.access.assign}
              assignmentReady={model.access.assignmentReady}
              canClose={model.access.close}
              canReopen={model.access.reopen}
              canReadHistory={model.access.history}
              canOpenOrder={model.access.order}
              onOrder={model.actions.order}
              onVerify={model.actions.verify}
            />
          </div>
          <HistoryPanel
            open={model.historyOpen}
            items={model.historyItems}
            condition={model.historyCondition}
            {...(model.historyError ? { error: model.historyError } : {})}
            {...(model.historyNextCursor ? { nextCursor: model.historyNextCursor } : {})}
            onClose={model.actions.closeHistory}
            onNext={model.actions.nextHistory}
            onRetry={model.actions.retryHistory}
          />
        </>
      )}
    </section>
  );
}
