import { MessageRole, MessageStatus } from "@prisma/client";

import { createMessage, updateMessage } from "../../mutations/message";
import { getConversationMessages } from "../../queries/message";
import { generateAssistantResponse } from "./engine";
import { ChatSource, ChatStreamEvent } from "../types";

type StreamConversationInput = {
    conversationId: string;
    message: string;
};

/**
 * Streams a conversation: progress steps, then the answer content.
 * @param input 
 * @returns AsyncGenerator<ChatStreamEvent>
 */
export async function* streamConversation({ conversationId, message }: StreamConversationInput): AsyncGenerator<ChatStreamEvent> {
    // Create USER message
    await createMessage({
        conversationId: conversationId, 
        role: MessageRole.USER, 
        content: message, 
        status: MessageStatus.COMPLETED
    });

    // Read before the empty ASSISTANT message exists so it never ends up in the prompt.
    const history = await getConversationMessages(conversationId);

    let generatedContent = "";
    let sources: ChatSource[] | undefined;

    // Create ASSISTANT message
    const assistantMessage = await createMessage({
        conversationId: conversationId, 
        role: MessageRole.ASSISTANT, 
        content: generatedContent, 
        status: MessageStatus.PENDING
    });

    // FAILED unless the generation goes to the end (error or client disconnect)
    let status: MessageStatus = MessageStatus.FAILED;

    try {
        // Stream assistant response
        for await (const event of generateAssistantResponse({ conversationId, message, history })) {
            // Yield the event to the caller; the answer and its sources are saved, steps are transient.
            yield event;

            if (event.type === "content") {
                generatedContent += event.content;
            } else if (event.type === "sources") {
                sources = event.sources;
            }
        }

        status = MessageStatus.COMPLETED;
    } catch (error) {
        console.error(`Assistant response failed for conversation ${conversationId}:`, error);
        throw error;
    } finally {
        // Single write once the generation ends instead of one write per token
        await updateMessage({
            messageId: assistantMessage.id,
            content: generatedContent,
            status,
            sources,
        });
    }
}