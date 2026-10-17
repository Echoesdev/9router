// [veille-a5] Health-check des fournisseurs LLM gratuits documentes dans
// docs/veille-a5-free-llm-apis.md.
//
// Principes :
// - Une requete minimale par fournisseur (liste des modeles ou validation
//   de cle) : aucun prompt client, aucune donnee sensible, aucun token
//   consomme quand l'endpoint le permet.
// - Deux sources de cles, en memoire uniquement : (1) l'environnement
//   (process.env / .env local), prioritaire ; (2) les connexions deja
//   stockees dans 9Router, fournies par l'appelant via le mecanisme
//   officiel getProviderConnections() (voir
//   scripts/check-free-tier-providers.mjs). Les valeurs ne sont jamais
//   retournees, journalisees, placees dans une URL ou incluses dans une
//   raison d'echec : seul le nom de la source ("env" / "stored" /
//   "anonymous" / "none") apparait dans le resultat.
// - URL figee par fournisseur (liste blanche dans
//   config/freeTierProviders.js) : aucune URL utilisateur, pas de SSRF.
//   Seule exception controlee : l'URL de sonde du noeud custom OVHcloud
//   stocke dans 9Router, validee (https, sans identifiants embarques)
//   avant usage, et jamais affichee.
// - Seul un fournisseur "valid" est marque usableForFreeRouting. Ce module
//   ne modifie AUCUN routage : il expose un statut. Brancher ce statut sur
//   le routage par defaut est une etape ulterieure, a valider separement.

import {
  FREE_TIER_PROVIDERS,
  FREE_TIER_HEALTH_TIMEOUT_MS,
} from "../config/freeTierProviders.js";

const ACCOUNT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const STORED_PROVIDER_MAP = {
  mistral: "mistral",
  gemini: "gemini",
  openrouter: "openrouter-free",
  groq: "groq",
  "cloudflare-ai": "cloudflare-workers-ai",
};

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function firstEnvValue(envKeys, env) {
  for (const name of envKeys || []) {
    const value = nonEmptyString(env?.[name]);
    if (value) return { name, value };
  }
  return null;
}

// Construit, a partir des connexions renvoyees par getProviderConnections(),
// les candidats de sonde par fournisseur. Les cles restent en memoire dans
// cette structure interne : ne jamais la journaliser ni la retourner telle
// quelle dans un rapport.
export function buildStoredProviderCandidates(connections) {
  const byProvider = {};
  const push = (specId, candidate) => {
    if (!byProvider[specId]) byProvider[specId] = [];
    byProvider[specId].push(candidate);
  };
  for (const conn of connections || []) {
    if (!conn || conn.isActive === false || conn.isActive === 0) continue;
    if (conn.authType && conn.authType !== "apikey") continue;
    const apiKey = nonEmptyString(conn.apiKey);
    if (!apiKey) continue;
    const psd = conn.providerSpecificData || {};
    const directSpecId = STORED_PROVIDER_MAP[conn.provider];
    if (directSpecId) {
      push(directSpecId, {
        source: "stored",
        apiKey,
        accountId: nonEmptyString(psd.accountId),
        probeUrl: null,
      });
      continue;
    }
    // Noeud custom OVHcloud : connexion openai-compatible-chat-* dont le
    // noeud s'appelle OVHcloud. Son URL de base stockee sert de sonde
    // apres validation stricte ; elle n'est jamais affichee.
    const isCustom = typeof conn.provider === "string" && conn.provider.startsWith("openai-compatible-chat-");
    const nodeName = nonEmptyString(psd.nodeName) || nonEmptyString(conn.name);
    if (isCustom && nodeName && nodeName.toLowerCase().startsWith("ovhcloud")) {
      let probeUrl = null;
      const baseUrl = nonEmptyString(psd.baseUrl);
      if (baseUrl) {
        try {
          const parsed = new URL(baseUrl);
          if (parsed.protocol === "https:" && !parsed.username && !parsed.password) {
            probeUrl = `${baseUrl.replace(/\/+$/, "")}/models`;
          }
        } catch {
          probeUrl = null;
        }
      }
      push("ovhcloud-ai-endpoints", { source: "stored", apiKey, accountId: null, probeUrl });
    }
  }
  return byProvider;
}

function baseResult(spec, checkedAt) {
  return {
    id: spec.id,
    name: spec.name,
    registryId: spec.registryId ?? null,
    status: "untested",
    usableForFreeRouting: false,
    source: "none",
    attempts: 0,
    reason: null,
    httpStatus: null,
    latencyMs: null,
    checkedAt,
  };
}

async function probeOnce(spec, candidate, { fetchFn, timeoutMs }) {
  const headers = {
    Accept: "application/json",
    "User-Agent": "9router-free-tier-healthcheck/1.0",
  };
  if (candidate.apiKey && spec.probe.auth === "bearer") {
    headers.Authorization = `Bearer ${candidate.apiKey}`;
  } else if (candidate.apiKey && spec.probe.auth === "x-goog-api-key") {
    headers["x-goog-api-key"] = candidate.apiKey;
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetchFn(candidate.probeUrl || spec.probe.url, {
      method: spec.probe.method || "GET",
      headers,
      signal: controller.signal,
    });
    return {
      ok: Boolean(response?.ok),
      httpStatus: typeof response?.status === "number" ? response.status : null,
      latencyMs: Date.now() - startedAt,
      timedOut: false,
      errorName: null,
    };
  } catch (error) {
    return {
      ok: false,
      httpStatus: null,
      latencyMs: Date.now() - startedAt,
      timedOut,
      // Ne jamais reprendre error.message : il pourrait contenir une URL ou
      // une valeur sensible selon le transport. Nom d'erreur uniquement.
      errorName: error && typeof error.name === "string" ? error.name : "Error",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkFreeTierProvider(spec, options = {}) {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const env = options.env ?? process.env;
  const timeoutMs =
    Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : FREE_TIER_HEALTH_TIMEOUT_MS;
  const now = options.now ?? (() => new Date());
  const result = baseResult(spec, now().toISOString());

  const storedByProvider =
    options.storedCandidates ?? buildStoredProviderCandidates(options.connections);
  const storedCandidates = storedByProvider[spec.id] || [];

  const candidates = [];
  const envKey = spec.requiresKey ? firstEnvValue(spec.envKeys, env) : null;
  if (envKey) {
    candidates.push({
      source: "env",
      apiKey: envKey.value,
      accountId: spec.envAccount ? nonEmptyString(env[spec.envAccount]) : null,
      probeUrl: null,
    });
  }
  candidates.push(...storedCandidates);
  if (!spec.requiresKey && candidates.length === 0) {
    candidates.push({ source: "anonymous", apiKey: null, accountId: null, probeUrl: null });
  }

  if (candidates.length === 0) {
    result.reason = `non teste : cle absente (${(spec.envKeys || []).join(" ou ")}, aucune connexion stockee active)`;
    return result;
  }

  let firstFailure = null;
  for (const candidate of candidates) {
    // Cloudflare exige aussi un account id : sans lui, ce candidat est
    // "non teste", pas un echec.
    if (spec.envAccount && !candidate.accountId) {
      if (candidates.length === 1) {
        result.source = candidate.source;
        result.reason = `non teste : ${spec.envAccount} absent`;
        return result;
      }
      continue;
    }
    if (spec.envAccount && !ACCOUNT_ID_PATTERN.test(candidate.accountId)) {
      result.status = "failed";
      result.source = candidate.source;
      result.reason = "echec : identifiant de compte au format invalide";
      return result;
    }
    const probeUrl =
      candidate.probeUrl ||
      (spec.envAccount
        ? spec.probe.url.replace("{accountId}", encodeURIComponent(candidate.accountId || ""))
        : spec.probe.url);
    result.attempts += 1;
    const outcome = await probeOnce(spec, { ...candidate, probeUrl }, { fetchFn, timeoutMs });
    result.source = candidate.source;
    result.latencyMs = outcome.latencyMs;
    result.httpStatus = outcome.httpStatus;
    if (outcome.ok) {
      result.status = "valid";
      result.usableForFreeRouting = true;
      result.reason = "repond (sonde minimale OK)";
      return result;
    }
    const failure = outcome.timedOut || outcome.errorName === "AbortError" || outcome.errorName === "TimeoutError"
      ? `echec : timeout apres ${timeoutMs} ms`
      : outcome.httpStatus !== null
        ? `echec : HTTP ${outcome.httpStatus}`
        : `echec : erreur reseau (${outcome.errorName || "Error"})`;
    if (!firstFailure) firstFailure = { reason: failure, source: candidate.source, httpStatus: outcome.httpStatus, latencyMs: outcome.latencyMs };
    // Un autre candidat (autre connexion stockee) peut encore repondre.
  }

  if (firstFailure) {
    result.status = "failed";
    result.source = firstFailure.source;
    result.httpStatus = firstFailure.httpStatus;
    result.latencyMs = firstFailure.latencyMs;
    result.reason = firstFailure.reason;
  } else {
    // Tous les candidats etaient inutilisables (account id manquant).
    result.reason = `non teste : ${spec.envAccount} absent`;
  }
  return result;
}

export async function checkAllFreeTierProviders(options = {}) {
  const only = Array.isArray(options.only) && options.only.length > 0 ? new Set(options.only) : null;
  const specs = FREE_TIER_PROVIDERS.filter((spec) => !only || only.has(spec.id));
  const nowFn = options.now ?? (() => new Date());
  const checkedAt = nowFn().toISOString();
  const storedCandidates = buildStoredProviderCandidates(options.connections);
  const providers = [];
  // Sequentiel : OVHcloud anonyme est limite a 2 req/min/IP/modele, et un
  // health-check n'a aucune raison de rafaler les fournisseurs.
  for (const spec of specs) {
    providers.push(await checkFreeTierProvider(spec, { ...options, storedCandidates }));
  }
  const summary = {
    total: providers.length,
    valid: providers.filter((p) => p.status === "valid").length,
    failed: providers.filter((p) => p.status === "failed").length,
    untested: providers.filter((p) => p.status === "untested").length,
    usableForFreeRouting: providers
      .filter((p) => p.usableForFreeRouting)
      .map((p) => p.id),
  };
  return { checkedAt, providers, summary };
}

export { FREE_TIER_PROVIDERS };
