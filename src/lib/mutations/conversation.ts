"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { pipelineRuntime } from "@/lib/pipeline/runtime";


export async function createConversation(formData: FormData) {
    const projectId = formData.get("projectId")?.toString();

    if (!projectId) return; // TODO : Handle validation error

    // The pipeline generation model is the default model of a new conversation.
    const { generation } = (await pipelineRuntime.getConfig()).parameters;
    const model = await prisma.aIModel.findFirst({
        where: { providerId: generation.providerId, name: generation.modelName },
        select: { id: true },
    });

    const res = await prisma.conversation.create({data: {
        projectId: projectId,
        modelId: model?.id,
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
 * The model can only be changed before the first message: a conversation keeps the model it was started with.
 */
export async function updateConversationModel(conversationId: string, modelId: string) {
    const { count } = await prisma.conversation.updateMany({
        where: { id: conversationId, messages: { none: {} } },
        data: { modelId },
    });

    if (count === 0) {
        throw new Error("Le modèle ne peut plus être changé une fois la conversation commencée.");
    }
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