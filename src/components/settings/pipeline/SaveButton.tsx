"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "success" | "error";

const FEEDBACK_DURATION_MS = 1500;

const statusIcons: Record<SaveStatus, React.ReactNode> = {
  idle: null,
  saving: <Spinner />,
  success: <Check aria-label="Enregistré" />,
  error: <X aria-label="Échec de l'enregistrement" />,
};

/** Submit button with a spinner that turns into a check or a cross for a moment, then calls onReset. */
export function SaveButton({ status, onReset }: { status: SaveStatus; onReset: () => void }) {
  useEffect(() => {
    if (status !== "success" && status !== "error") {
      return;
    }

    const timeout = setTimeout(onReset, FEEDBACK_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [status, onReset]);

  return (
    <Button
      type="submit"
      disabled={status === "saving"}
      // Feedback states stay fully visible but can't trigger a second save.
      className={cn(status !== "idle" && status !== "saving" && "pointer-events-none")}
    >
      <AnimatePresence initial={false}>
        {status !== "idle" && (
          // Width animates so the text slides right when the icon appears; the negative margin cancels the button gap while hidden.
          <motion.span
            initial={{ width: 0, marginRight: -4, opacity: 0 }}
            animate={{ width: "auto", marginRight: 0, opacity: 1 }}
            exit={{ width: 0, marginRight: -4, opacity: 0 }}
            className="flex overflow-hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={status}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="flex"
              >
                {statusIcons[status]}
              </motion.span>
            </AnimatePresence>
          </motion.span>
        )}
      </AnimatePresence>
      Enregistrer
    </Button>
  );
}
