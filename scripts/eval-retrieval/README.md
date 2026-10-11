# Évaluation de la recherche documentaire

Ces scripts mesurent si la recherche du chat retrouve le bon passage, pour comparer des réglages
(recherche sémantique seule ou hybride, seuil, poids lexical…) sur des chiffres plutôt qu'au ressenti.

## Ce qu'on teste

Pour chaque passage d'un échantillon tiré des documents indexés, un modèle écrit la question qu'un
utilisateur poserait pour le retrouver. On pose ensuite cette question à la recherche, avec chaque
réglage, et on regarde si **la page du passage** figure parmi les `topK` résultats.

Deux styles de questions, toujours en français :

| Style | Exemple | Ce qu'il éprouve |
| --- | --- | --- |
| précise | « Quel est le numéro de référence exact du pignon bas de marche arrière ayant 15 dents ? » | les termes exacts, les références : le terrain de la recherche lexicale (BM25) |
| vague | « Comment on passe les vitesses en marche arrière ? » | des mots courants, des synonymes : le terrain de la recherche sémantique |

## Comment on le mesure

La recherche est exactement celle du chat : même requête Qdrant (`buildHybridQuery`), même modèle
d'embedding calculé sur le CPU, même traduction de la question dans les 4 langues. Seuls les
paramètres de la recherche changent d'un réglage à l'autre ; ils partent de ceux enregistrés dans
la page Pipeline.

Pour chaque réglage :

| Colonne | Signification |
| --- | --- |
| page | part des questions dont la page source est dans les résultats |
| document | part des questions dont le document source est dans les résultats, quelle que soit la page |
| MRR | moyenne de 1 / rang de la page source (1 : toujours en tête, 0,5 : en moyenne 2ᵉ, 0 : jamais trouvée) |
| autre langue | pages trouvées pour les passages anglais ou russes, la question étant en français |
| résultats | nombre moyen de résultats renvoyés : sous `topK`, le seuil sémantique en a écarté |

Les réglages comparés sont la liste `SETTINGS` en tête de `evaluate.ts` : modifiez-la pour tester
d'autres valeurs.

## Utilisation

Depuis la racine du dépôt, avec Qdrant, Ollama et des documents indexés :

```bash
# 1. Une fois : échantillonne ~40 passages et écrit 2 questions par passage (quelques minutes)
npm run eval:questions -- --count 40 --model ministral-3:8b

# 2. Autant de fois que voulu : compare les réglages
npm run eval:retrieval
```

`eval:questions` utilise par défaut le modèle de génération du pipeline. Il refuse de remplacer un
jeu existant sans `--force` : le jeu de questions est la règle de mesure, en changer rend les
résultats incomparables avec les précédents.

Les données générées vont dans `data/`, hors de git, car elles dépendent des documents locaux :

- `questions.json` : les passages (document, page, langue) et leurs questions ;
- `prepared.json` : le vecteur et les traductions de chaque question, calculés au premier lancement de
  `eval:retrieval` puis réutilisés. Ce cache est recalculé si le modèle d'embedding ou de traduction change.

Les deux scripts ne modifient ni la base ni Qdrant. Après une réindexation, `eval:retrieval` reste
valable : le passage est identifié par son document et sa page, pas par l'identifiant du chunk.

## Lire les résultats avec prudence

- **Une quarantaine de passages, c'est peu** : un écart de 2 à 5 points correspond à une ou deux
  questions. Seuls les écarts nets comptent.
- **La fusion RRF produit des égalités de score**, que Qdrant départage arbitrairement : deux lancements
  identiques peuvent différer d'une ou deux questions.
- **Les questions précises favorisent la recherche lexicale**, le modèle reprenant les mots du passage ;
  les questions vagues sont plus proches d'un usage réel mais certaines ne sont pas vraiment couvertes
  par leur passage, ce qui plafonne leurs scores.

## Mesures de référence (11/10/2026)

42 passages, `qwen3-embedding:4b`, traduction `ministral-3:8b`, `topK` 5 :

| Réglage | Précises : page / document | Vagues : page / document |
| --- | --- | --- |
| sémantique seule, seuil 0,55 | 93 % / 95 % | 31 % / 33 % |
| hybride, seuil 0,55 | 98 % / 100 % | 38 % / 60 % |
| hybride, seuil 0,35 | 98 % / 100 % | 57 % / 81 % |

D'où le seuil sémantique par défaut à 0,35 : avec ce modèle, une question vague dépasse rarement
0,55 de similarité avec son passage.
