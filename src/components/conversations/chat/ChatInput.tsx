import { Field } from "@/components/ui/field";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

import { sendMessage } from "@/lib/mutations/chat";

type Props = {
  conversationId: string;
  projectId: string;
};

export async function ChatInput({ conversationId, projectId }: Props) {
  return (
    <div className="flex p-4 gap-4 w-full justify-center">
      <form action={sendMessage} className="w-full">
        <input
          type="hidden"
          name="projectId"
          value={projectId}
        />

        <input
          type="hidden"
          name="conversationId"
          value={conversationId}
        />

        <input
          type="hidden"
          name="role"
          value="user"
        />

        <input
          type="hidden"
          name="status"
          value="pending"
        />

        <Field>
          <InputGroup className="w-[70%] h-15 rounded-4xl p-4">
            <InputGroupInput placeholder="Type to search..." name="content"/>
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit">Search</InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </form>
    </div>
  );
}
