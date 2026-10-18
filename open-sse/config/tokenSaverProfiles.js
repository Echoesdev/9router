// [veille-economie-tokens] Profils de sobriété tokens — DOCUMENTAIRES et OPT-IN.
//
// Ces profils décrivent des réglages recommandés (voir
// docs/veille-economie-tokens-9router.md). Ils ne sont branchés sur AUCUN
// routage : les appliquer reste un geste manuel et explicite dans le
// dashboard, et le routage par défaut de 9Router est inchangé (décision
// Christophe 2026-10-18 : « non en l'état » pour le routage automatique
// basé sur le statut `valid` du health-check).
//
// Seuls les fournisseurs gratuits VALIDÉS par un test réel le 2026-10-18
// (HTTP 200, sondes fictives, aucune donnée client) peuvent figurer ici :
// OVHcloud, Mistral, Gemini, OpenRouter. Groq et Cloudflare Workers AI sont
// volontairement absents : aucune clé, jamais testés (`untested`).
// Les identifiants de modèles cités existent dans le registre du dépôt
// (open-sse/providers/registry/*.js) ou sont des modèles `:free`
// d'OpenRouter à confirmer dans le dashboard avant usage ; un profil ne
// crée ni ne suppose aucune clé.

export const TOKEN_SAVER_VALIDATED_PROVIDERS = [
  "ovhcloud-ai-endpoints",
  "mistral",
  "gemini",
  "openrouter",
];

// Réglages 9Router existants (src/lib/db/repos/settingsRepo.js) recommandés
// par profil. `rtkEnabled` compresse les tool_result (défaut : true, déjà
// actif). `caveman`/`ponytail` injectent un style de réponse concis
// (défaut : false). Aucun de ces champs n'est écrit par ce fichier.
export const TOKEN_SAVER_PROFILES = {
  eco: {
    label: "Éco — tâches simples et répétitives",
    useFor: ["résumé", "classification", "extraction", "brouillon", "triage de logs"],
    settings: { rtkEnabled: true, cavemanLevel: "lite", headroomEnabled: false, pxpipeEnabled: false },
    // Exemples sobres : petits modèles rapides des fournisseurs validés.
    // À confirmer dans le dashboard (liste /v1/models du fournisseur).
    exampleModels: [
      { provider: "gemini", model: "gemini-2.5-flash-lite" },
      { provider: "mistral", model: "mistral-medium-latest" },
    ],
    guidance: {
      suggestedMaxOutputTokens: 1024,
      keepContext: "historique court ; /clear ou session neuve par tâche",
    },
  },
  equilibre: {
    label: "Équilibré — travail courant",
    useFor: ["code courant", "rédaction", "analyse de documents courts"],
    settings: { rtkEnabled: true, cavemanLevel: "lite", headroomEnabled: false, pxpipeEnabled: false },
    exampleModels: [
      { provider: "gemini", model: "gemini-2.5-flash" },
      { provider: "mistral", model: "mistral-medium-latest" },
    ],
    guidance: {
      suggestedMaxOutputTokens: 4096,
      keepContext: "compacter quand l'historique dépasse le besoin de la tâche",
    },
  },
  qualite: {
    label: "Qualité — tâche difficile, sobriété quand même",
    useFor: ["architecture", "revue de sécurité", "décision structurante"],
    settings: { rtkEnabled: true, cavemanLevel: null, headroomEnabled: false, pxpipeEnabled: false },
    exampleModels: [
      { provider: "gemini", model: "gemini-2.5-pro" },
      { provider: "mistral", model: "mistral-large-latest" },
    ],
    guidance: {
      suggestedMaxOutputTokens: 8192,
      keepContext: "contexte complet utile ; ne pas compresser les traces d'erreur (RTK les préserve déjà)",
    },
  },
};

export function getTokenSaverProfile(name) {
  return TOKEN_SAVER_PROFILES[name] || null;
}
