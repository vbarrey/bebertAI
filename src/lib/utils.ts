import { MessageRole } from "@prisma/client";
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generatorToHttpStream<T>(
  generator: AsyncGenerator<T>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await generator.next();

      if (done) {
        controller.close();
        return;
      }

      controller.enqueue(
        encoder.encode(`${JSON.stringify(value)}\n`)
      );
    },

    async cancel() {
      await generator.return?.(undefined);
    },
  });
}

export function messageRoleToString(role: MessageRole): "user" | "assistant" | "system" {
  switch (role) {
    case MessageRole.USER:
      return "user";
    case MessageRole.ASSISTANT:
      return "assistant";
    case MessageRole.SYSTEM:
      return "system";
  }
}
