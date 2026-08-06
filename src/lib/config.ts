export const config = {
    ollama: {
        host: process.env.OLLAMA_HOST ?? "http://localhost:11434",
        model: process.env.OLLAMA_MODEL ?? "qwen3:1.7b",
    },
};