interface ClipboardReader {
  readText(): Promise<string>;
}

export class AddressClipboardError extends Error {
  constructor(readonly code: 'unavailable' | 'empty' | 'denied') {
    super(code === 'empty' ? '剪贴板中没有可识别的地址' : '请长按粘贴');
    this.name = 'AddressClipboardError';
  }
}

export async function readAddressClipboard(
  clipboard: ClipboardReader | undefined = typeof navigator === 'undefined' ? undefined : navigator.clipboard,
): Promise<string> {
  if (!clipboard?.readText) throw new AddressClipboardError('unavailable');
  try {
    const text = (await clipboard.readText()).trim();
    if (!text) throw new AddressClipboardError('empty');
    return text;
  } catch (error) {
    if (error instanceof AddressClipboardError) throw error;
    throw new AddressClipboardError('denied');
  }
}
