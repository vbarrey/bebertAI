"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";


export async function createConversation(formData: FormData) {
    const projectId = formData.get("projectId")?.toString();

    if (!projectId) return; // TODO : Handle validation error

    const res = await prisma.conversation.create({data: {
        projectId: projectId
    }});

    revalidatePath(`/projects/${projectId}/conversations`);
    redirect(`/projects/${projectId}/conversations/${res.id}`);
}

export async function renameConversation(formData: FormData) {
    const projectId = formData.get("projectId")?.toString();
    const conversationId = formData.get("conversationId")?.toString();
    const title = formData.get("title")?.toString();

    if (!conversationId || !title) return; // TODO : Handle validation error

    await prisma.conversation.update({
        where: {
            id: conversationId,
            projectId: projectId
        },
        data: {
            title: title
        }
    });

    revalidatePath(`/projects/${projectId}/conversations`);
    revalidatePath(`/projects/${projectId}/conversations/${conversationId}`);
}

/**
 * Also delete all messages by casacade
 * @param conversationId 
 */
export async function deleteConversation(formData: FormData) {
    const projectId = formData.get("projectId")?.toString();
    const conversationId = formData.get("conversationId")?.toString();

    if (!conversationId || !projectId) return; // TODO : Handle validation error    

    await prisma.conversation.delete({
        where: {
            id: conversationId,
            projectId: projectId
        }
    });

    revalidatePath(`/projects/${projectId}/conversations`);
}