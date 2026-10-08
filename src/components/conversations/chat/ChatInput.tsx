"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { updateConversationModel } from "@/lib/mutations/conversation";

import { Field } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

import { AIModelSelector } from "./AIModelSelector";
import { Provider } from "@/types/augmented-prisma";

type Props = {
  conversationId: string;
  onSendMessage: (message: string) => Promise<void>;
  isStreaming: boolean;
  providersModels: Provider[];
  initialModel: { providerId: string; modelName: string };
  // The model can only be picked before the first message.
  modelLocked: boolean;
};

export function ChatInput({
  conversationId,
  onSendMessage,
  isStreaming,
  providersModels,
  initialModel,
  modelLocked,
}: Props) {
  const [providerId, setProviderId] = useState(initialModel.providerId);

  const [modelName, setModelName] = useState(initialModel.modelName);

  const [isUpdatingModel, setIsUpdatingModel] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

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

  async function handleSubmit(formData: FormData) {
    const message = formData.get("content")?.toString();
    if (!message) return;
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onSendMessage(message);
  }

  return (
    <div className="flex w-full max-w-5xl justify-center items-center gap-4 p-4 m-auto">
      <form
        action={handleSubmit}
        className="flex w-full items-center gap-4"
      >
        <Field>
          <InputGroup className="h-15 w-[70%] rounded-4xl p-4 shadow-md">
            <InputGroupInput
              placeholder="Type to discuss..."
              name="content"
              autoComplete="off"
              disabled={isStreaming}
              ref={inputRef}
            />

            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="submit"
                disabled={isStreaming || isUpdatingModel}
              >
                {isStreaming ? "Sending..." : "Send"}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </form>

      <AIModelSelector
        providerId={providerId}
        modelName={modelName}
        providers={providersModels}
        disabled={isStreaming || isUpdatingModel}
        locked={modelLocked}
        onProviderChange={handleProviderChange}
        onModelChange={handleModelChange}
      />
    </div>
  );
}