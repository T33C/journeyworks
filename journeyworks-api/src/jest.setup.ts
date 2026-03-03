import { ReadableStream as NodeReadableStream } from 'node:stream/web';

if (!(global as any).ReadableStream) {
  (global as any).ReadableStream = NodeReadableStream;
}
