import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { HttpStream } from '../../../../foundation/interface/HttpStream';
import type { RealtimePort, SupportRealtimeEvent, SupportStreamPresenter } from '../../application/port/RealtimePort';

export class SupportEventStream implements SupportStreamPresenter {
  constructor(private readonly realtime: RealtimePort) {}

  present(input: Parameters<SupportStreamPresenter['present']>[0]): ReturnType<SupportStreamPresenter['present']> {
    const body = new HttpStream((signal) => frames(input.replay, this.realtime.read({ ...input, signal })));
    body.onClose(input.release);
    return { status: 200, body: body as never };
  }
}

async function* frames(replay: Parameters<SupportStreamPresenter['present']>[0]['replay'], events: ReturnType<RealtimePort['read']>) {
  for (const event of replay) yield frame(event);
  for await (const event of events) {
    yield frame(event);
  }
}

function frame(event: SupportRealtimeEvent) {
  const { memberId: _memberId, ...visible } = event;
  return { id: event.id, event: event.type, data: visible, retry: RUNTIME_LIMITS.stream.reconnectMinimumMilliseconds };
}
