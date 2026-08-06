import { MessageRole, MessageStatus } from "@prisma/client";

import { createMessage, updateMessage } from "../mutations/message";
import { generateAssistantResponse } from "../chat/engine";
import { ChatChunk } from "./type";

type StreamConversationInput = {
    conversationId: string;
    message: string;
};

/**
 * Streams a conversation and yields chat chunks.
 * @param input 
 * @returns AsyncGenerator<ChatChunk>
 */
export async function* streamConversation({ conversationId, message }: StreamConversationInput): AsyncGenerator<ChatChunk> {
    // Create USER message
    await createMessage({
        conversationId: conversationId, 
        role: MessageRole.USER, 
        content: message, 
        status: MessageStatus.COMPLETED
    });

    let generatedContent = "";

    // Create ASSISTANT message
    const assistantMessage = await createMessage({
        conversationId: conversationId, 
        role: MessageRole.ASSISTANT, 
        content: generatedContent, 
        status: MessageStatus.PENDING
    });

    // Stream assistant response
    for await (const chunk of generateAssistantResponse({conversationId: conversationId, message: message})) {
        // Yield the chunk to the caller
        yield chunk;
        generatedContent += chunk.delta;
        // Update ASSISTANT message with the new content and status STREAMING
        await updateMessage({
            messageId: assistantMessage.id,
            content: generatedContent,
            status: MessageStatus.STREAMING
        });
    }

    // Update ASSISTANT message status to COMPLETED
    await updateMessage({
        messageId: assistantMessage.id,
        content: generatedContent,
        status: MessageStatus.COMPLETED
    });
}