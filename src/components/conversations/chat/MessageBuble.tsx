import { Message, MessageRole } from "@prisma/client";

type Props = {
  message: Omit<Message, "conversationId" | "updatedAt">;
};

export async function MessageBuble({ message }: Props) {
  switch (message.role) {
    case MessageRole.USER:
      return (
        <div className="ml-auto mt-4 mb-4 mr-4 border rounded-md p-4 min-w-min max-w-2/3 bg-gray-100">
          {message.content}
        </div>
      );
    case MessageRole.ASSISTANT:
      return (
        <div className="mr-auto mt-4 mb-4 ml-4 border rounded-md p-4 min-w-min max-w-2/3">
          {message.content}
        </div>
      );
    default:
      return (
        <div className="m-auto mt-4 mb-4 border rounded-md p-4 min-w-min max-w-2/3">
          {message.content}
        </div>
      );
  }
}
