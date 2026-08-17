import { streamConversation } from "@/lib/ai/chat/stream";
import { generatorToHttpStream } from "@/lib/utils";

export async function POST(req: Request) {
    const { conversationId, message, providerId, modelId } = await req.json();

    if (!conversationId || !message || !providerId || !modelId) {
        return new Response("Cannot parse chat request : { conversationId, message, modelId }", { status: 400 });
    }

    const generator = streamConversation({ conversationId, message, providerId, modelId });
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