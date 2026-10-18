"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { toast } from "sonner";

import { updateConversationModel } from "@/lib/mutations/conversation";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";

import { AIModelSelector } from "./AIModelSelector";
import { Provider } from "@/types/augmented-prisma";

type Props = {
  conversationId: string;
  onSendMessage: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  providersModels: Provider[];
  initialModel: { providerId: string; modelName: string };
  // The model can only be picked before the first message.
  modelLocked: boolean;
};

export function ChatInput({
  conversationId,
  onSendMessage,
  onStop,
  isStreaming,
  providersModels,
  initialModel,
  modelLocked,
}: Props) {
  const [providerId, setProviderId] = useState(initialModel.providerId);

  const [modelName, setModelName] = useState(initialModel.modelName);

  const [isUpdatingModel, setIsUpdatingModel] = useState(false);

  const [message, setMessage] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ready for the next question once the answer ends, and on opening the conversation.
  useEffect(() => {
    if (!isStreaming) textareaRef.current?.focus();
  }, [isStreaming]);

  async function selectModel(
    nextProviderId: string,
    nextModelName: string,
  ) {
    const model = providersModels
      .find((provider) => provider.id === nextProviderId)
      ?.models?.find((model) => model.name === nextModelName);

    if (!model) return;

    setIsUpdatingModel(true);

    try {
      await updateConversationModel(conversationId, model.id);

      setProviderId(nextProviderId);
      setModelName(nextModelName);
    } catch {
      toast.error("Impossible de modifier le modèle de la conversation.");
    } finally {
      setIsUpdatingModel(false);
    }
  }

  async function handleProviderChange(nextProviderId: string) {
    const provider = providersModels.find(
      (provider) => provider.id === nextProviderId,
    );

    if (!provider) return;

    const currentModelExists = provider.models?.some(
      (model) => model.name === modelName,
    );

    const nextModelName = currentModelExists
      ? modelName
      : provider.models?.[0].name;

    if (!nextModelName) return;

    await selectModel(nextProviderId, nextModelName);
  }

  async function handleModelChange(nextModelName: string) {
    await selectModel(providerId, nextModelName);
  }

  const canSend = message.trim() !== "" && !isStreaming && !isUpdatingModel;

  function submit() {
    if (!canSend) return;
    onSendMessage(message.trim());
    setMessage("");
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 pt-2 pb-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <InputGroup className="rounded-3xl has-[textarea]:rounded-3xl bg-background px-2 py-1.5 shadow-md dark:bg-input/30">
          <InputGroupTextarea
            ref={textareaRef}
            placeholder="Posez votre question…"
            aria-label="Votre question"
            name="content"
            rows={1}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter goes to the line; not while an IME composes a character.
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            className="max-h-48 min-h-10 px-3 py-2.5 text-base md:text-sm"
          />

          <InputGroupAddon align="inline-end" className="self-end pb-1">
            {isStreaming ? (
              <InputGroupButton
                type="button"
                size="icon-sm"
                variant="default"
                className="size-8 rounded-full"
                onClick={onStop}
                aria-label="Arrêter la réponse"
              >
                <Square className="fill-current" />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                type="submit"
                size="icon-sm"
                variant="default"
                className="size-8 rounded-full"
                disabled={!canSend}
                aria-label="Envoyer"
              >
                <ArrowUp />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>

      <div className="flex items-center justify-between gap-2 px-2">
        <AIModelSelector
          providerId={providerId}
          modelName={modelName}
          providers={providersModels}
          disabled={isStreaming || isUpdatingModel}
          locked={modelLocked}
          onProviderChange={handleProviderChange}
          onModelChange={handleModelChange}
        />

        <p className="hidden text-xs text-muted-foreground sm:block">
          Entrée pour envoyer, Maj+Entrée pour aller à la ligne
        </p>
      </div>
    </div>
  );
}
