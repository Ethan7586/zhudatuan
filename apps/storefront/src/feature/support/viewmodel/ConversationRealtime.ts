import { useEffect, useRef, useState } from 'react';
import { useDependencies } from '../../../app/DependencyContext';
import type { StorefrontSession } from '../../../entity/session';
import { conversationDrafts, type ConversationDraftState } from '../application/ConversationDraft';
import { ListenSupportEvents } from '../application/ListenSupportEvents';
import { initialSupportEventState, reduceSupportEvent } from './SupportEventReducer';
import { reconnectDelay } from './ReconnectDelay';

export function useConversationRealtime(input: Readonly<{
  session: StorefrontSession | null;
  caseId: string;
  conversationId: string | undefined;
  refreshLatest: () => Promise<void>;
  refreshTicket: () => Promise<unknown>;
  updateDraft: (value: ConversationDraftState) => void;
  notify: (message: string) => void;
}>): boolean {
  const dependencies = useDependencies();
  const listener = useRef(new ListenSupportEvents(dependencies.support));
  const eventState = useRef(initialSupportEventState);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    eventState.current = initialSupportEventState;
    setConnected(false);
  }, [input.caseId]);
  useEffect(() => {
    if (!input.session || !input.conversationId) return;
    const controller = new AbortController();
    let reconnect = 0;
    const listen = async () => {
      while (!controller.signal.aborted) {
        try {
          setConnected(true);
          await listener.current.execute(input.session!, input.conversationId!, (event) => {
            const decision = reduceSupportEvent(eventState.current, event);
            eventState.current = decision.state;
            if (!decision.accepted || event.ticketId !== input.caseId) return;
            if (event.evidenceId && (event.type === 'support.attachment.ready' || event.type === 'support.attachment.rejected')) {
              const draft = conversationDrafts.read(input.caseId);
              input.updateDraft({ ...draft, attachments: draft.attachments.map((item) => item.id === event.evidenceId ? { ...item, state: event.type === 'support.attachment.ready' ? 'clean' : 'rejected' } : item) });
            }
            void Promise.all([input.refreshLatest(), input.refreshTicket()]);
          }, controller.signal, eventState.current.cursor);
          reconnect = 0;
        } catch {
          if (controller.signal.aborted) break;
          setConnected(false);
          input.notify('实时连接正在恢复，已同步服务器最新状态。');
          await Promise.allSettled([input.refreshLatest(), input.refreshTicket()]);
          await reconnectDelay(Math.min(5_000, 500 * 2 ** reconnect), controller.signal);
          reconnect += 1;
        }
      }
    };
    void listen();
    return () => controller.abort();
  }, [input]);
  return connected;
}
