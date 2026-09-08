export interface ShareContent {
  readonly title: string;
  readonly text: string;
  readonly url: string;
}

export type ShareOutcome = 'shared' | 'copied';

export interface SharePort {
  share(content: ShareContent): Promise<ShareOutcome>;
}
