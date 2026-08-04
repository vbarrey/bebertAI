import { streamConversation } from "@/lib/chat/stream";
import { generatorToHttpStream } from "@/lib/utils";

export async function POST(req: Request) {
    const { conversationId, message } = await req.json();

    if (!conversationId || !message) {
        return new Response("Missing conversationId or message", { status: 400 });
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