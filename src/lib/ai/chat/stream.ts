import { MessageRole, MessageStatus } from "@prisma/client";

import { createMessage, updateMessage } from "../../mutations/message";
import { generateAssistantResponse } from "./engine";
import { ChatChunk } from "../types";

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

    // FAILED unless the generation goes to the end (error or client disconnect)
    let status: MessageStatus = MessageStatus.FAILED;

    try {
        // Stream assistant response
        for await (const chunk of generateAssistantResponse({conversationId: conversationId, message: message })) {
            // Yield the chunk to the caller
            yield chunk;
            generatedContent += chunk.content;
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
            status
        });
    }
}