// Shared by the engine (server) and the chat UI: keep it free of server imports.
export const CHAT_STEPS = {
  ANALYZING: "Analyse de la question",
  RETRIEVING: "Récupération des documents pertinents",
  BUILDING_CONTEXT: "Création du contexte de réponse",
  THINKING: "Réflexion",
} as const;

export type ChatStep = keyof typeof CHAT_STEPS;
