/**
 * One-shot worker request/response helper. The worker receives a message,
 * posts back the result (or {error}) and is terminated — these conversions
 * run at user-action pace, so there is nothing to keep warm.
 */
export function runWorker<TIn, TResult>(
  create: () => Worker,
  message: TIn,
): Promise<TResult> {
  return new Promise((resolve, reject) => {
    const worker = create();
    const terminate = () => worker.terminate();
    worker.onmessage = (event: MessageEvent) => {
      terminate();
      const data = event.data as { error?: string } & Record<string, unknown>;
      if (data && typeof data === 'object' && typeof data.error === 'string') {
        reject(new Error(data.error));
      } else {
        resolve(event.data as TResult);
      }
    };
    worker.onerror = () => {
      terminate();
      reject(new Error('Worker crashed during conversion'));
    };
    worker.postMessage(message);
  });
}
