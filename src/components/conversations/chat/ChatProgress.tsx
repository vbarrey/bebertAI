"use client";

import { AnimatePresence, motion } from "motion/react";

import { CHAT_STEPS, type ChatStep } from "@/lib/ai/chat/steps";

type ChatProgressProps = {
  step: ChatStep;
};

/**
 * Current step of the answer being prepared: each new step wipes the previous one out from left to right.
 */
export function ChatProgress({ step }: ChatProgressProps) {
  return (
    <div role="status" aria-live="polite" className="text-sm">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={step}
          className="chat-progress-shimmer inline-block"
          initial={{ clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          exit={{ clipPath: "inset(0 0 0 100%)" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {CHAT_STEPS[step]}…
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
