-- AIProviderType.OLLAMA renamed OLLAMA_LOCAL (SQLite stores enums as TEXT).
UPDATE "AIProvider" SET "type" = 'OLLAMA_LOCAL' WHERE "type" = 'OLLAMA';
