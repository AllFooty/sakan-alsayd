import { toast } from 'sonner';

interface ShowUndoToastOpts {
  message: string;
  undoLabel: string;
  restoredMessage: string;
  failedMessage: string;
  // Return true on success, false on failure. Throwing is treated as failure.
  onUndo: () => Promise<boolean>;
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
          const ok = await opts.onUndo();
          if (ok) {
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
