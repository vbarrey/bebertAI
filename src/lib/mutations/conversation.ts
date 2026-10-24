"use server";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { pipelineRuntime } from "@/lib/pipeline/runtime";
import { getPipelineProvider } from "@/lib/pipeline/config";
import { getConversationModels } from "@/lib/ai/chat/engine";
import { generateTitle, provisionalTitle } from "@/lib/ai/chat/title";
import { requireUser } from "@/lib/session";
import { usableProviders } from "@/lib/ai/provider-access";

const MAX_TITLE_LENGTH = 100;

// The sidebar lists the conversations on every page: each change is revalidated with the app layout.
function revalidateConversations() {
    revalidatePath("/", "layout");
}

/**
 * Opens a new conversation, in the project given or outside any project. An empty one of the same place is reused:
 * clicking "Nouvelle conversation" twice does not leave empty conversations behind.
 */
export async function createConversation(formData: FormData) {
    const user = await requireUser();
    const projectId = formData.get("projectId")?.toString() || null;
    if (projectId && !(await prisma.project.count({ where: { id: projectId, userId: user.id } }))) notFound();

    const empty = await prisma.conversation.findFirst({
        where: { userId: user.id, projectId, messages: { none: {} } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
    });

    if (empty) redirect(`/conversations/${empty.id}`);

    // The pipeline generation model is the default model of a new conversation.
    const { generation } = (await pipelineRuntime.getConfig()).parameters;
    const model = await prisma.aIModel.findFirst({
        where: { providerId: generation.providerId, name: generation.modelName, provider: usableProviders(user.id) },
        select: { id: true },
    });

    const res = await prisma.conversation.create({data: {
        userId: user.id,
        projectId: projectId,
        modelId: model?.id,
    }});

    revalidateConversations();
    redirect(`/conversations/${res.id}`);
}

export async function renameConversation(conversationId: string, title: string) {
    const user = await requireUser();
    const trimmed = title.trim().slice(0, MAX_TITLE_LENGTH);
    if (!trimmed) return;

    await prisma.conversation.updateMany({ where: { id: conversationId, userId: user.id }, data: { title: trimmed } });
    revalidateConversations();
}

/** Moves the conversation into a project, or out of any project with null: the user's own project only. */
export async function moveConversation(conversationId: string, projectId: string | null) {
    const user = await requireUser();
    if (projectId && !(await prisma.project.count({ where: { id: projectId, userId: user.id } }))) return;

    await prisma.conversation.updateMany({ where: { id: conversationId, userId: user.id }, data: { projectId } });
    revalidateConversations();
}

/**
 * Deletes the last question and its answer, to ask it again (regenerate, retry). Returns the question, null when
 * the conversation does not end with a question and its answer.
 */
export async function removeLastExchange(conversationId: string): Promise<string | null> {
    const user = await requireUser();
    const [answer, question] = await prisma.message.findMany({
        where: { conversationId, conversation: { userId: user.id } },
        orderBy: { createdAt: "desc" },
        take: 2,
        select: { id: true, role: true, content: true },
    });

    if (answer?.role !== "ASSISTANT" || question?.role !== "USER") return null;

    await prisma.message.deleteMany({ where: { id: { in: [answer.id, question.id] } } });
    return question.content;
}

/**
 * Titles the conversation with the small model once its first answer is complete.
 * Only replaces the provisional title: a title given by hand meanwhile stays. Returns the title, null when unchanged.
 */
export async function generateConversationTitle(conversationId: string): Promise<string | null> {
    const user = await requireUser();
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId, userId: user.id },
        select: {
            title: true,
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

    revalidateConversations();
    return title;
}

/**
 * The model can only be changed before the first message: a conversation keeps the model it was started with.
 */
export async function updateConversationModel(conversationId: string, modelId: string) {
    const user = await requireUser();
    if (!(await prisma.aIModel.count({ where: { id: modelId, provider: usableProviders(user.id) } }))) {
        throw new Error("Modèle introuvable.");
    }

    const { count } = await prisma.conversation.updateMany({
        where: { id: conversationId, userId: user.id, messages: { none: {} } },
        data: { modelId },
    });

    if (count === 0) {
        throw new Error("Le modèle ne peut plus être changé une fois la conversation commencée.");
    }
}

/** Deletes the conversation and its messages (cascade). */
export async function deleteConversation(conversationId: string) {
    const user = await requireUser();
    await prisma.conversation.deleteMany({ where: { id: conversationId, userId: user.id } });
    revalidateConversations();
}