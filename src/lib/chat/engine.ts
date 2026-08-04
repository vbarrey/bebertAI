type InputMessage = {
    conversationId: string;
    message: string;
};

type OutputMessage = {
    conversationId: string;
    message: string;
};

export async function generateAssistantResponse(input: InputMessage): Promise<OutputMessage> {
    return new Promise(resolve => setTimeout(() => resolve({ conversationId: input.conversationId, message: "Bonjour, je suis Bebert AI!" }), 1000));
}