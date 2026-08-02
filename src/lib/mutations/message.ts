import { prisma } from "../prisma";

import { MessageRole, MessageStatus } from "@prisma/client";

export async function createMessage(formData: FormData) {
    const conversationId = formData.get("conversationId")?.toString();
    const role = messageRoleFromString(formData.get("role")?.toString());
    const content = formData.get("content")?.toString();
    const status = messageStatusFromString(formData.get("status")?.toString());

    if (!conversationId || !role || !content || !status) return; // TODO : Handle validation error

    await prisma.message.create({data: {
        conversationId: conversationId,
        role: role,
        content: content,
        status: status
    }});
}

export async function updateMessage(formData: FormData) {
    const content = formData.get("content")?.toString();
    const messageId = formData.get("messageId")?.toString();
    
    if(!messageId || !content) return; // TODO : Handle validation error

    await prisma.message.update({where: {id: messageId}, data: {content: content}});
}

export async function deleteMessage(formData: FormData) {
    const messageId = formData.get("messageId")?.toString();

    if(!messageId) return; // TODO : Handle validation error

    await prisma.message.delete({where: {id: messageId}});
}

function messageRoleFromString(role: string | undefined): MessageRole | undefined {
    if (!role) return undefined;
    switch (role) {
        case "user":
            return MessageRole.USER;
        case "assistant":
            return MessageRole.ASSISTANT;
        case "system":
            return MessageRole.SYSTEM;
        default:
            return undefined;
    }
}

function messageStatusFromString(status: string | undefined): MessageStatus | undefined {
    if (!status) return undefined;
    switch (status) {
        case "pending":
            return MessageStatus.PENDING;
        case "streaming":
            return MessageStatus.STREAMING;
        case "completed":
            return MessageStatus.COMPLETED;
        case "failed":
            return MessageStatus.FAILED;
        default:
            return undefined;
    }
}