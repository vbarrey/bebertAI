import { streamConversation } from "@/lib/ai/chat/stream";
import { generatorToHttpStream } from "@/lib/utils";
import { apiUser } from "@/lib/session";

export async function POST(req: Request) {
    const { error: authError } = await apiUser();
    if (authError) return authError;

    const { conversationId, message } = await req.json();

    if (!conversationId || !message ) {
        return new Response("Cannot parse chat request : { conversationId, message }", { status: 400 });
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