// Shared by the chat UI (provisional title) and the server (generated title): keep it free of server imports.
import type { AIProviderClient } from "@/lib/ai/provider";

const PROVISIONAL_LENGTH = 50;
const MAX_LENGTH = 60;

// In English, like the query translator: a French prompt pulls every title into French.
const SYSTEM_PROMPT = `You title a conversation between a user and a document search assistant.
The title is 3 to 6 words, written in the language of the user's question, and says what the conversation is about.
Answer with the title only: no quotes, no final punctuation, no "Title:".`;

// Enough of the answer to tell the subject; the question carries most of it.
const ANSWER_EXCERPT_LENGTH = 1000;

// A few words: this only stops a runaway answer.
const MAX_TOKENS = 64;

/** Cut on a word boundary with an ellipsis when longer than maxLength. */
function shorten(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    const cut = text.slice(0, maxLength - 1);
    const lastSpace = cut.lastIndexOf(" ");
    return `${(lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** The first message on one line, shortened: the title until the generated one replaces it. */
export function provisionalTitle(message: string): string {
    return shorten(message.replace(/\s+/g, " ").trim(), PROVISIONAL_LENGTH);
}

/** The title in a model answer: its first line without Markdown, quotes, label or final punctuation; null if none. */
export function cleanTitle(answer: string): string | null {
    const line = answer
        // A reasoning model may still think out loud.
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .split("\n")
        .map((text) => text.trim())
        .find(Boolean);

    if (!line) return null;

    const title = line
        .replace(/^#+\s*/, "")
        .replace(/[*_`]/g, "")
        .replace(/^(titre|title)\s*:\s*/i, "")
        .replace(/^["'«“‘\s]+/, "")
        // Closing quotes and final punctuation, in any order.
        .replace(/["'»”’.!?:;,\s]+$/, "")
        .trim();

    return title ? shorten(title, MAX_LENGTH) : null;
}

/** A short title for the conversation from its first exchange. Never fails: null when the model gives none. */
export async function generateTitle(
    provider: AIProviderClient,
    modelName: string,
    question: string,
    answer: string,
): Promise<string | null> {
    let generated = "";

    try {
        for await (const chunk of provider.chat({
            modelName,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                    role: "user",
                    content: `Question: ${question}\n\nAnswer: ${answer.slice(0, ANSWER_EXCERPT_LENGTH)}`,
                },
            ],
            temperature: 0,
            maxTokens: MAX_TOKENS,
            // Reasoning would only add latency to a title.
            think: false,
        })) {
            generated += chunk.content;
        }
    } catch (error) {
        console.warn(`[ConversationTitle] Title generation failed with ${modelName}:`, error);
        return null;
    }

    return cleanTitle(generated);
}
