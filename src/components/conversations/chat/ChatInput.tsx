import { useState } from "react";

import { Field } from "@/components/ui/field";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { AIModelSelector } from "./AIModelSelector";

type Props = {
  onSendMessage: (
    message: string,
    aiId: { providerId: string; modelId: string }
  ) => Promise<void>;
  isStreaming: boolean;
  providersModels: {
    id: string;
    name: string;
    isDefault: boolean;
    defaultModelId: string | null;
    models: { name: string; id: string }[];
  }[];
};

export function ChatInput({
  onSendMessage,
  isStreaming,
  providersModels,
}: Props) {

  const aiIdItems = providersModels.map((p) => {
    return {
      id: p.id,
      name: p.name,
      models: p.models.map((m) => {
        return {
          name: m.name,
          id: m.id,
          value: JSON.stringify({ providerId: p.id, modelId: m.id }),
          default: p.isDefault && p.defaultModelId == m.id,
        };
      }),
    };
  });

  const [aiId, setAiId] = useState<string>(aiIdItems.map(item => item.models).flat().find(model => model.default)?.value ?? "");

  const handleSubmit = (formData: FormData) => {
    const message = formData.get("content")?.toString();

    if (!message || !aiId) return; // TODO : Handle validation error

    try {
      onSendMessage(message, JSON.parse(aiId));
    } catch (error) {
      throw new Error("Unable to parse providerId and modelId");
    }
  };

  return (
    <div className="flex p-4 gap-4 w-full justify-center">
      <form action={handleSubmit} className="w-full">
        <AIModelSelector
          isStreaming={isStreaming}
          aiIdItems={aiIdItems}
          value={aiId}
          onValueChange={setAiId}
        />
        <Field>
          <InputGroup className="w-[70%] h-15 rounded-4xl p-4">
            <InputGroupInput placeholder="Type to search..." name="content" />
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit" disabled={isStreaming}>
                {isStreaming ? "Sending..." : "Search"}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </form>
    </div>
  );
}
