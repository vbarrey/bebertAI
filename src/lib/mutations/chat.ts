"use server";

import { MessageRole, MessageStatus } from "@prisma/client";

import { createMessage } from "./message";
import { generateAssistantResponse } from "../chat/engine";
import { revalidatePath } from "next/cache";

/**
 * TODO :
 * - Read user message
 * - Create Message (role: USER) 
 * - Update lastMessageAt on conversation
 * - Call generateAssistantResponse from lib/chat.ts
 * - Create Message (role: ASSISTANT)
 * - revalidate coversation page
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
        conversationId: conversationId!, 
        role: MessageRole.USER, 
        content: message, 
        status: MessageStatus.COMPLETED // TODO : When using streaming, we should set this to "pending" and update it to "completed" when the streaming is done 
    });

    // Call generateAssistantResponse from lib/chat.ts
    const messageResponse = await generateAssistantResponse({ conversationId: conversationId!, message });

    // Create ASSISTANT message
    await createMessage({
        conversationId: conversationId!, 
        role: MessageRole.ASSISTANT, 
        content: messageResponse.message, 
        status: MessageStatus.COMPLETED // TODO : When using streaming, we should set this to "pending" and update it to "completed" when the streaming is done
    });

    revalidatePath(`/projects/${projectId}/conversations/${conversationId}`);
}