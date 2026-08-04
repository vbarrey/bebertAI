"use server";

import { prisma } from "../prisma";

import { MessageRole, MessageStatus } from "@prisma/client";

type CreateMessageInput = {
    conversationId: string;
    role: MessageRole;
    content: string;
    status: MessageStatus;
};

type CreateMessageOutput = {
    id: string;
    conversationId: string;
};

export async function createMessage({conversationId, role, content, status}: CreateMessageInput): Promise<CreateMessageOutput> {
    return prisma.$transaction(async (tx) => {
        // Create message
        const message = await tx.message.create({data: {
            conversationId: conversationId,
            role: role,
            content: content,
            status: status
        }});
        // Update lastMessageAt on conversation
        await tx.conversation.update({
            where: {
                id: conversationId
            },
            data: {
                lastMessageAt: new Date()
            }
        });

        return { id: message.id, conversationId: message.conversationId };
    });
}

type UpdateMessageInput = {
    messageId: string;
    content: string;
    status: MessageStatus;
};

export async function updateMessage({messageId, content, status}: UpdateMessageInput) {
    await prisma.message.update({where: {id: messageId}, data: {content: content, status: status}});
}

export async function deleteMessage(formData: FormData) {
    const messageId = formData.get("messageId")?.toString();

    if(!messageId) return; // TODO : Handle validation error

    await prisma.message.delete({where: {id: messageId}});
}