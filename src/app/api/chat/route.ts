import { streamConversation } from "@/lib/ai/chat/stream";
import { generatorToHttpStream } from "@/lib/utils";
import { apiUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    const { user, error: authError } = await apiUser();
    if (authError) return authError;

    const { conversationId, message } = await req.json().catch(() => ({}));

    if (!conversationId || !message ) {
        return new Response("Cannot parse chat request : { conversationId, message }", { status: 400 });
    }

    // The engine then works on this conversation: its history, and its owner's documents only.
    if (!(await prisma.conversation.count({ where: { id: conversationId, userId: user.id } }))) {
        return new Response("Conversation introuvable.", { status: 404 });
    }

    const generator = streamConversation({ conversationId, message });
    const stream = generatorToHttpStream(generator);

    return new Response(
        stream,
        {
            headers: {
                "Content-Type": "application/x-ndjson",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        }
    );
}