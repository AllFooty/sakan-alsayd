import { toast } from 'sonner';

// Return value semantics:
//   true       → restore succeeded; helper shows restoredMessage.
//   false      → generic failure; helper shows failedMessage.
//   'handled'  → caller already surfaced its own toast (e.g. a specific
//                409 error message); helper does NOT show any toast.
export type UndoResult = boolean | 'handled';

interface ShowUndoToastOpts {
  message: string;
  undoLabel: string;
  restoredMessage: string;
  failedMessage: string;
  onUndo: () => Promise<UndoResult>;
  durationMs?: number;
}

// Fires a Sonner toast with a single Undo action button. The action is the
// caller's responsibility — the destructive mutation has already happened by
// the time this is called. We just surface the rollback affordance.
export function showUndoToast(opts: ShowUndoToastOpts): void {
  toast(opts.message, {
    duration: opts.durationMs ?? 6000,
    action: {
      label: opts.undoLabel,
      onClick: async () => {
        try {
          const result = await opts.onUndo();
          if (result === 'handled') return;
          if (result) {
            toast.success(opts.restoredMessage);
          } else {
            toast.error(opts.failedMessage);
          }
        } catch {
          toast.error(opts.failedMessage);
        }
      },
    },
  });
}
