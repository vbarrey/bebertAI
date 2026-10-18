"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { pipelineRuntime } from "@/lib/pipeline/runtime";
import { getPipelineProvider } from "@/lib/pipeline/config";
import { getConversationModels } from "@/lib/ai/chat/engine";
import { generateTitle, provisionalTitle } from "@/lib/ai/chat/title";

const MAX_TITLE_LENGTH = 100;


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
    const title = formData.get("title")?.toString().trim().slice(0, MAX_TITLE_LENGTH);

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
 * Deletes the last question and its answer, to ask it again (regenerate, retry). Returns the question, null when
 * the conversation does not end with a question and its answer.
 */
export async function removeLastExchange(conversationId: string): Promise<string | null> {
    const [answer, question] = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        take: 2,
        select: { id: true, role: true, content: true },
    });

    if (answer?.role !== "ASSISTANT" || question?.role !== "USER") return null;

    await prisma.message.deleteMany({ where: { id: { in: [answer.id, question.id] } } });
    return question.content;
}

/**
 * The first message as title, until the generated one: an untitled conversation only, a title given by hand stays.
 */
export async function setProvisionalTitle(conversationId: string, message: string) {
    await prisma.conversation.updateMany({
        where: { id: conversationId, title: null },
        data: { title: provisionalTitle(message) },
    });
}

/**
 * Titles the conversation with the small model once its first answer is complete.
 * Only replaces the provisional title: a title given by hand meanwhile stays. Returns the title, null when unchanged.
 */
export async function generateConversationTitle(conversationId: string): Promise<string | null> {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
            title: true,
            projectId: true,
            messages: { orderBy: { createdAt: "asc" }, take: 3, select: { role: true, status: true, content: true } },
        },
    });

    const [question, answer, ...others] = conversation?.messages ?? [];

    if (
        !conversation || others.length > 0
        || question?.role !== "USER" || answer?.role !== "ASSISTANT" || answer.status !== "COMPLETED"
        || conversation.title !== provisionalTitle(question.content)
    ) {
        return null;
    }

    const { smallModel } = await getConversationModels(conversationId, (await pipelineRuntime.getConfig()).parameters);

    let title: string | null;
    try {
        const provider = await getPipelineProvider(smallModel, "titre");
        title = await generateTitle(provider, smallModel.modelName, question.content, answer.content);
    } catch (error) {
        console.warn(`[ConversationTitle] No title model for conversation ${conversationId}:`, error);
        return null;
    }

    if (!title) return null;

    const { count } = await prisma.conversation.updateMany({
        where: { id: conversationId, title: conversation.title },
        data: { title },
    });

    if (count === 0) return null;

    revalidatePath(`/projects/${conversation.projectId}`);
    return title;
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

    revalidatePath(`/projects/${projectId}`);
}