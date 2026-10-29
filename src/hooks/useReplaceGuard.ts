import { useCallback, useRef, useState } from 'react';

/** How a destructive document operation proceeds. */
export type ReplaceDecision = 'replace' | 'insert' | 'cancel';

export interface ReplaceRequest {
  /** File the content comes from (file name for the dialog copy). */
  sourceName: string;
  /** DOCX import allows inserting at the cursor instead of replacing. */
  allowInsert: boolean;
}

interface PendingRequest extends ReplaceRequest {
  resolve: (decision: ReplaceDecision) => void;
}

/**
 * Guards every operation that can replace the open document (Open, Explorer
 * file handoff, DOCX import). Closing the window already had its own dialog;
 * this closes the same hole everywhere else so unsaved edits are never lost
 * silently.
 */
export function useReplaceGuard(isDirty: () => boolean) {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);

  const beforeReplace = useCallback(
    (request: ReplaceRequest): Promise<ReplaceDecision> => {
      if (!isDirty()) return Promise.resolve('replace');
      return new Promise<ReplaceDecision>((resolve) => {
        const entry: PendingRequest = { ...request, resolve };
        pendingRef.current = entry;
        setPending(entry);
      });
    },
    [isDirty],
  );

  const decide = useCallback((decision: ReplaceDecision) => {
    const entry = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    entry?.resolve(decision);
  }, []);

  return { pending, beforeReplace, decide };
}
