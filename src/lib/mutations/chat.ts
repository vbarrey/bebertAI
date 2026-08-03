"use server";

import { createMessage } from "./message";
import { generateAssistantResponse } from "../chat";
import { revalidatePath } from "next/cache";

/**
 * TODO :
 * - Read user message
 * - Create Message (role: USER) 
 * - Update lastMessageAt on conversation (if necessary bc prisma might do it for us thanks to @updateAt rule)
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
    await createMessage(formData);

    // Call generateAssistantResponse from lib/chat.ts
    const messageResponse = await generateAssistantResponse(conversationId, message);

    // Create ASSISTANT message
    const assistantMessageFormData = new FormData();
    assistantMessageFormData.set("conversationId", conversationId!);
    assistantMessageFormData.set("role", "assistant");
    assistantMessageFormData.set("content", messageResponse);
    assistantMessageFormData.set("status", "pending");

    console.log("assistantMessageFormData =>", assistantMessageFormData);

    await createMessage(assistantMessageFormData);

    revalidatePath(`projects/${projectId}/conversations/${conversationId}`);
}