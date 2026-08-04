"use server";

import { prisma } from "../prisma";

import { MessageRole, MessageStatus } from "@prisma/client";

type CreateMessageInput = {
    conversationId: string;
    role: MessageRole;
    content: string;
    status: MessageStatus;
};

export async function createMessage({conversationId, role, content, status}: CreateMessageInput) {
    await prisma.$transaction([
        // Create message
        prisma.message.create({data: {
            conversationId: conversationId,
            role: role,
            content: content,
            status: status
        }}),
        // Update lastMessageAt on conversation
        prisma.conversation.update({
            where: {
                id: conversationId
            },
            data: {
                lastMessageAt: new Date()
            }
        })
    ]);
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