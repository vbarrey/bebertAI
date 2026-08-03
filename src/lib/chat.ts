

export async function generateAssistantResponse(conversationId: string, content: string): Promise<string> {
    return new Promise(resolve => setTimeout(() => resolve("Bonjour, je suis Bebert AI!"), 1000));
}