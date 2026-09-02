import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { HttpStream } from '../../../../foundation/interface/HttpStream';
import type { RealtimePort, SupportStreamPresenter } from '../../application/port/RealtimePort';

export class SupportEventStream implements SupportStreamPresenter {
  constructor(private readonly realtime: RealtimePort) {}

  present(input: Parameters<SupportStreamPresenter['present']>[0]): ReturnType<SupportStreamPresenter['present']> {
    const body = new HttpStream((signal) => frames(this.realtime.read({ ...input, signal })));
    body.onClose(input.release);
    return { status: 200, body: body as never };
  }
}

async function* frames(events: ReturnType<RealtimePort['read']>) {
  for await (const event of events) {
    const { memberId: _memberId, ...visible } = event;
    yield { id: event.id, event: event.type, data: visible, retry: RUNTIME_LIMITS.stream.reconnectMinimumMilliseconds };
  }
}
