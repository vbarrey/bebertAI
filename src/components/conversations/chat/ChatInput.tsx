import { Field } from "@/components/ui/field";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

type Props = {
  onSendMessage: (message: string) => Promise<void>;
  isStreaming: boolean;
};

export function ChatInput({ onSendMessage, isStreaming }: Props) {
  
  const handleSubmit = (formData: FormData) => {
    const message = formData.get("content")?.toString();

    if(!message) return; // TODO : Handle validation error

    onSendMessage(message);
  }
  
  return (
    <div className="flex p-4 gap-4 w-full justify-center">
      <form action={handleSubmit} className="w-full">
        <Field>
          <InputGroup className="w-[70%] h-15 rounded-4xl p-4">
            <InputGroupInput placeholder="Type to search..." name="content"/>
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
