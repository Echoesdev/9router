// [veille-a5] Teste les fournisseurs LLM gratuits documentes dans
// docs/veille-a5-free-llm-apis.md et valide automatiquement ceux qui
// repondent. Voir open-sse/services/freeTierHealthCheck.js.
//
// Usage :
//   node scripts/check-free-tier-providers.mjs
//   node scripts/check-free-tier-providers.mjs --json
//   node scripts/check-free-tier-providers.mjs --only ovhcloud-ai-endpoints,groq
//   node scripts/check-free-tier-providers.mjs --timeout 5000 --out rapport.json
//   node scripts/check-free-tier-providers.mjs --no-stored
//
// Sources de cles (en memoire uniquement, jamais affichees) :
//   1. l'environnement, ou le fichier .env a la racine du depot s'il existe
//      (jamais commite) ;
//   2. sauf --no-stored, les connexions deja stockees dans 9Router, lues
//      via le mecanisme officiel getProviderConnections()
//      (src/lib/db/repos/connectionsRepo.js, alias "@/" resolu par
//      scripts/loaders/src-alias-loader.mjs).
// Une cle absente des deux sources donne "non teste", pas une erreur.
// Code de sortie : 0 si aucun fournisseur teste n'a echoue, 1 sinon.
// Ce script ne modifie ni la configuration ni le routage de 9Router.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";
import { checkAllFreeTierProviders } from "../open-sse/services/freeTierHealthCheck.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnvIfPresent() {
  const envPath = resolve(repoRoot, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (process.env[name] !== undefined) continue;
    process.env[name] = rawValue.replace(/^["']|["']$/g, "");
  }
}

async function loadStoredConnections() {
  // La couche DB journalise son initialisation sur stdout : on la bascule
  // sur stderr le temps du chargement pour garder --json propre.
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = (...args) => console.error(...args);
  console.warn = (...args) => console.error(...args);
  try {
    register("./loaders/src-alias-loader.mjs", import.meta.url);
    const { getProviderConnections } = await import("../src/lib/db/repos/connectionsRepo.js");
    return await getProviderConnections({ isActive: true });
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

function parseArgs(argv) {
  const args = { json: false, only: null, timeoutMs: null, out: null, stored: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") args.json = true;
    else if (arg === "--no-stored") args.stored = false;
    else if (arg === "--only") args.only = (argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--timeout") args.timeoutMs = Number.parseInt(argv[++i], 10);
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log("Usage: node scripts/check-free-tier-providers.mjs [--json] [--only id,id] [--timeout ms] [--out rapport.json] [--no-stored]");
  process.exit(0);
}

loadDotEnvIfPresent();

let connections = [];
let storedSource = "disabled";
if (args.stored) {
  try {
    connections = await loadStoredConnections();
    storedSource = "9router-db";
  } catch {
    // Base illisible (app arretee, pilote absent...) : on continue avec la
    // seule source environnement, sans afficher d'erreur technique qui
    // pourrait contenir des chemins ou des valeurs sensibles.
    storedSource = "unavailable";
    connections = [];
  }
}

const report = await checkAllFreeTierProviders({
  env: process.env,
  connections,
  only: args.only ?? undefined,
  timeoutMs: Number.isFinite(args.timeoutMs) && args.timeoutMs > 0 ? args.timeoutMs : undefined,
});
report.storedSource = storedSource;

if (args.out) {
  writeFileSync(resolve(repoRoot, args.out), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Health-check fournisseurs gratuits - ${report.checkedAt} (source stockee : ${storedSource})`);
  for (const p of report.providers) {
    const latency = p.latencyMs === null ? "-" : `${p.latencyMs} ms`;
    const http = p.httpStatus === null ? "-" : `HTTP ${p.httpStatus}`;
    console.log(`- ${p.id} : ${p.status} (${http}, ${latency}, source ${p.source}) - ${p.reason}`);
  }
  console.log(
    `Resume : ${report.summary.valid} valide(s), ${report.summary.failed} echec(s), ` +
      `${report.summary.untested} non teste(s). Utilisables pour le routage gratuit : ` +
      `${report.summary.usableForFreeRouting.join(", ") || "aucun"}.`
  );
}

process.exit(report.summary.failed > 0 ? 1 : 0);
