/** Provides the browser File streaming contract that JSDOM does not implement. */
export function streamingFile(content: string, name: string, type: string): File {
  const bytes = new TextEncoder().encode(content);
  const file = new File([bytes], name, { type });
  Object.defineProperty(file, 'stream', {
    configurable: true,
    value: () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
  });
  return file;
}
