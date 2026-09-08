import type { ShareContent, ShareOutcome, SharePort } from './SharePort';

interface BrowserShareClient {
  readonly share?: (content: ShareContent) => Promise<void>;
  readonly clipboard?: {
    writeText(value: string): Promise<void>;
  };
}

export class BrowserShareAdapter implements SharePort {
  constructor(private readonly client: BrowserShareClient) {}

  async share(content: ShareContent): Promise<ShareOutcome> {
    if (this.client.share) {
      await this.client.share(content);
      return 'shared';
    }
    if (!this.client.clipboard) throw new Error('SHARE_UNAVAILABLE');
    await this.client.clipboard.writeText(content.url);
    return 'copied';
  }
}
