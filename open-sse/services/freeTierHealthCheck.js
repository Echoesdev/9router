// [veille-a5] Health-check des fournisseurs LLM gratuits documentes dans
// docs/veille-a5-free-llm-apis.md.
//
// Principes :
// - Une requete minimale par fournisseur (liste des modeles ou validation
//   de cle) : aucun prompt client, aucune donnee sensible, aucun token
//   consomme quand l'endpoint le permet.
// - Les cles sont lues uniquement depuis l'environnement fourni (process.env
//   par defaut). Elles ne sont jamais retournees, journalisees, placees dans
//   une URL ou incluses dans une raison d'echec.
// - URL figee par fournisseur (liste blanche dans
//   config/freeTierProviders.js) : aucune URL utilisateur, pas de SSRF.
// - Seul un fournisseur "valid" est marque usableForFreeRouting. Ce module
//   ne modifie AUCUN routage : il expose un statut, consomme par le script
//   scripts/check-free-tier-providers.mjs. Brancher ce statut sur le
//   routage par defaut est une etape ulterieure, a valider separement.

import {
  FREE_TIER_PROVIDERS,
  FREE_TIER_HEALTH_TIMEOUT_MS,
} from "../config/freeTierProviders.js";

const ACCOUNT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function firstEnvValue(envKeys, env) {
  for (const name of envKeys || []) {
    const value = env?.[name];
    if (typeof value === "string" && value.trim() !== "") {
      return { name, value: value.trim() };
    }
  }
  return null;
}

function baseResult(spec, checkedAt) {
  return {
    id: spec.id,
    name: spec.name,
    registryId: spec.registryId ?? null,
    status: "untested",
    usableForFreeRouting: false,
    reason: null,
    httpStatus: null,
    latencyMs: null,
    checkedAt,
  };
}

export async function checkFreeTierProvider(spec, options = {}) {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const env = options.env ?? process.env;
  const timeoutMs =
    Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : FREE_TIER_HEALTH_TIMEOUT_MS;
  const now = options.now ?? (() => new Date());
  const checkedAt = now().toISOString();
  const result = baseResult(spec, checkedAt);

  let key = null;
  if (spec.requiresKey) {
    key = firstEnvValue(spec.envKeys, env);
    if (!key) {
      result.reason = `non teste : cle absente (${(spec.envKeys || []).join(" ou ")})`;
      return result;
    }
  }

  let url = spec.probe.url;
  if (spec.envAccount) {
    const accountRaw = env?.[spec.envAccount];
    const accountId = typeof accountRaw === "string" ? accountRaw.trim() : "";
    if (!accountId) {
      result.reason = `non teste : ${spec.envAccount} absent`;
      return result;
    }
    if (!ACCOUNT_ID_PATTERN.test(accountId)) {
      result.status = "failed";
      result.reason = "echec : identifiant de compte au format invalide";
      return result;
    }
    url = url.replace("{accountId}", encodeURIComponent(accountId));
  }

  const headers = {
    Accept: "application/json",
    "User-Agent": "9router-free-tier-healthcheck/1.0",
  };
  if (key && spec.probe.auth === "bearer") {
    headers.Authorization = `Bearer ${key.value}`;
  } else if (key && spec.probe.auth === "x-goog-api-key") {
    headers["x-goog-api-key"] = key.value;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetchFn(url, {
      method: spec.probe.method || "GET",
      headers,
      signal: controller.signal,
    });
    result.latencyMs = Date.now() - startedAt;
    result.httpStatus = typeof response?.status === "number" ? response.status : null;
    if (response?.ok) {
      result.status = "valid";
      result.usableForFreeRouting = true;
      result.reason = "repond (sonde minimale OK)";
    } else {
      result.status = "failed";
      result.reason = `echec : HTTP ${result.httpStatus ?? "inconnu"}`;
    }
  } catch (error) {
    result.latencyMs = Date.now() - startedAt;
    result.status = "failed";
    // Ne jamais reprendre error.message : il pourrait contenir une URL ou
    // une valeur sensible selon le transport. Nom d'erreur uniquement.
    const errorName = error && typeof error.name === "string" ? error.name : "Error";
    result.reason =
      timedOut || errorName === "AbortError" || errorName === "TimeoutError"
        ? `echec : timeout apres ${timeoutMs} ms`
        : `echec : erreur reseau (${errorName})`;
  } finally {
    clearTimeout(timer);
  }
  return result;
}

export async function checkAllFreeTierProviders(options = {}) {
  const only = Array.isArray(options.only) && options.only.length > 0 ? new Set(options.only) : null;
  const specs = FREE_TIER_PROVIDERS.filter((spec) => !only || only.has(spec.id));
  const nowFn = options.now ?? (() => new Date());
  const checkedAt = nowFn().toISOString();
  const providers = [];
  // Sequentiel : OVHcloud anonyme est limite a 2 req/min/IP/modele, et un
  // health-check n'a aucune raison de rafaler les fournisseurs.
  for (const spec of specs) {
    providers.push(await checkFreeTierProvider(spec, options));
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


