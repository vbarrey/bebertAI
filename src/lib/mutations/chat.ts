"use server";

import { MessageRole, MessageStatus } from "@prisma/client";

import { createMessage, updateMessage } from "./message";
import { generateAssistantResponse } from "../chat/engine";
import { revalidatePath } from "next/cache";

/**
 * Send a message in a conversation, create a USER message and an ASSISTANT message, and stream the assistant response.
 * @param formData 
 */
export async function sendMessage(formData: FormData) {
    // Read user message
    const message = formData.get("content")?.toString();
    const conversationId = formData.get("conversationId")?.toString();
    const projectId = formData.get("projectId")?.toString();

    if (!message || !conversationId || !projectId) return; // TODO : Handle validation error

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
    for await (const chunk of generateAssistantResponse({conversationId: conversationId, message: message!})) {
        generatedContent += chunk.delta;
        // TODO : Update ASSISTANT message with the new content and status STREAMING
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

    revalidatePath(`/projects/${projectId}/conversations/${conversationId}`); // TODO : When using streaming -> delete
}