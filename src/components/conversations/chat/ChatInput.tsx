"use client";

import { useRef, useState } from "react";

import type { PipelineParameters } from "@/lib/pipeline/parameters";

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
  onSendMessage: (message: string) => Promise<void>;
  isStreaming: boolean;
  providersModels: Provider[];
  parameters: PipelineParameters;
};

export function ChatInput({
  onSendMessage,
  isStreaming,
  providersModels,
  parameters,
}: Props) {
  const [providerId, setProviderId] = useState(parameters.generation.providerId);

  const [modelName, setModelName] = useState(parameters.generation.modelName);

  const [isUpdatingModel, setIsUpdatingModel] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  async function updateGenerationParameters(
    nextProviderId: string,
    nextModelName: string,
  ) {
    const nextParameters: PipelineParameters = {
      ...parameters,
      generation: {
        ...parameters.generation,
        providerId: nextProviderId,
        modelName: nextModelName,
      },
    };

    const response = await fetch("/api/pipeline", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(nextParameters),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        "error" in payload
          ? payload.error
          : "Impossible de modifier le modèle de génération.",
      );
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

    setIsUpdatingModel(true);

    try {
      await updateGenerationParameters(
        nextProviderId,
        nextModelName,
      );

      setProviderId(nextProviderId);
      setModelName(nextModelName);
    } finally {
      setIsUpdatingModel(false);
    }
  }

  async function handleModelChange(nextModelName: string) {
    setIsUpdatingModel(true);

    try {
      await updateGenerationParameters(
        providerId,
        nextModelName,
      );

      setModelName(nextModelName);
    } finally {
      setIsUpdatingModel(false);
    }
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
        onProviderChange={handleProviderChange}
        onModelChange={handleModelChange}
      />
    </div>
  );
}