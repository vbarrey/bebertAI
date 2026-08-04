import { sleep, randomInt } from "../utils";

type GenerateAssistantResponseInput  = {
    conversationId: string;
    message: string;
};

export type ChatChunk = {
    delta: string;
};
/**
 * Generates an assistant response for a given conversation and message. 
 * Should never call prisma
 * @param input 
 */
export async function* generateAssistantResponse(input: GenerateAssistantResponseInput ): AsyncGenerator<ChatChunk> {
    const mockResponse = `This is a mock response for the message: "${input.message}" in conversation: "${input.conversationId}".`.split(" ");

    // Simulate streaming by yielding chunks of the mock response
    for (const chunk of mockResponse) {
        await sleep(randomInt(100, 500)); // Simulate network delay
        yield { delta: chunk + " " };
    }
}