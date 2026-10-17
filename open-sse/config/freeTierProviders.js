// [veille-a5] Fournisseurs LLM gratuits documentes dans
// docs/veille-a5-free-llm-apis.md et sondes par
// open-sse/services/freeTierHealthCheck.js.
//
// Securite : aucune cle n'est stockee ici. Seuls les NOMS des variables
// d'environnement sont listes ; les valeurs sont lues a l'execution depuis
// l'environnement (ou le fichier .env local, jamais commite) et ne sont
// jamais journalisees, retournees ni incluses dans une URL.
// Les URL de sonde sont une liste blanche figee dans le code : aucune URL
// fournie par l'utilisateur n'est acceptee (pas de surface SSRF).

export const FREE_TIER_HEALTH_TIMEOUT_MS = 8000;

export const FREE_TIER_PROVIDERS = [
  {
    id: "ovhcloud-ai-endpoints",
    name: "OVHcloud AI Endpoints",
    registryId: null,
    requiresKey: false,
    envKeys: [],
    probe: {
      method: "GET",
      url: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models",
      auth: "none",
    },
  },
  {
    id: "mistral",
    name: "Mistral AI",
    registryId: "mistral",
    requiresKey: true,
    envKeys: ["MISTRAL_API_KEY"],
    probe: {
      method: "GET",
      url: "https://api.mistral.ai/v1/models",
      auth: "bearer",
    },
  },
  {
    id: "gemini",
    name: "Google Gemini",
    registryId: "gemini",
    requiresKey: true,
    envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    probe: {
      method: "GET",
      url: "https://generativelanguage.googleapis.com/v1beta/models",
      auth: "x-goog-api-key",
    },
  },
  {
    id: "cloudflare-workers-ai",
    name: "Cloudflare Workers AI",
    registryId: "cloudflare-ai",
    requiresKey: true,
    envKeys: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY"],
    envAccount: "CLOUDFLARE_ACCOUNT_ID",
    probe: {
      method: "GET",
      // {accountId} est remplace apres validation stricte du format.
      url: "https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/models/search?per_page=1",
      auth: "bearer",
    },
  },
  {
    id: "groq",
    name: "Groq",
    registryId: "groq",
    requiresKey: true,
    envKeys: ["GROQ_API_KEY"],
    probe: {
      method: "GET",
      url: "https://api.groq.com/openai/v1/models",
      auth: "bearer",
    },
  },
  {
    id: "openrouter-free",
    name: "OpenRouter (:free)",
    registryId: "openrouter",
    requiresKey: true,
    envKeys: ["OPENROUTER_API_KEY"],
    probe: {
      method: "GET",
      // Valide la cle sans envoyer aucun prompt.
      url: "https://openrouter.ai/api/v1/auth/key",
      auth: "bearer",
    },
  },
];
