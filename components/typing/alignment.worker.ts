import { align } from '../../lib/typing/scoring';

self.onmessage = ({ data }: MessageEvent<{ id: number; reference: string; typed: string }>) => {
  const { id, reference, typed } = data;
  try {
    self.postMessage({ id, alignment: align(reference, typed) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof RangeError ? 'budget' : 'worker' });
  }
};
