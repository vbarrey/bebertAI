/**
 * Queries embedded by the exporting side and again by the importing one: the vectors of a bundle fit the importing
 * user's model only when both give the same vectors for these (cosine at least CANARY_MIN_COSINE). Questions like the
 * ones users ask, French and English, short and long. Never change them: a bundle carries its own.
 */
export const CANARY_TEXTS = [
    "Comment régler l'avance à l'allumage ?",
    "Quelle est la pression des pneus recommandée ?",
    "Qui a signé le traité de Versailles en 1919 ?",
    "Où se trouvait le régiment pendant l'hiver 1916 ?",
    "liste des pièces détachées du carburateur",
    "Quand faut-il faire la vidange du moteur ?",
    "Résume le chapitre sur la mobilisation générale.",
    "Quel est le numéro de référence du pignon de marche arrière ?",
    "photos de la ferme familiale",
    "lettre écrite depuis le front à sa mère",
    "What is the torque setting for the cylinder head bolts?",
    "How do I replace the brake pads?",
    "Which battalion landed on the beach on D-Day?",
    "Explique la différence entre un moteur deux temps et un moteur quatre temps.",
    "carte d'identité militaire",
    "Combien de soldats ont été blessés lors de cette bataille ?",
    "Comment démonter la boîte de vitesses ?",
    "recette de cuisine de grand-mère",
    "Quels documents parlent de l'Indochine ?",
    "schéma électrique du circuit d'éclairage",
];

// Ollama Q8 and DeepInfra give 0.999 at worst on queries, a Q4 Ollama 0.973 (npm run eval:compat): a lower cosine is
// another model, or the same one too degraded to search these vectors.
export const CANARY_MIN_COSINE = 0.99;
