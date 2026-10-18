# Veille économie de tokens — 9Router : état des lieux et réglages recommandés

> 2026-10-18 (Europe/Berlin), branche `feat/veille-economie-tokens` empilée sur
> `feat/veille-a5-healthcheck-fournisseurs`. **Routage par défaut inchangé**
> (décision Christophe : « non en l'état »). Aucune clé lue, affichée ou requise.

## Ce que 9Router sait déjà faire (constaté dans le code)

| Levier | Où | Défaut actuel | Effet tokens |
|---|---|---|---|
| **RTK** (compression des `tool_result` : diffs, grep, logs, listes) | `open-sse/rtk/`, branché dans `open-sse/handlers/chatCore.js` | `rtkEnabled: true` — **déjà actif** | Réduit les tokens d'**entrée** des gros résultats d'outils. Fail-open, préserve les traces d'erreur (`is_error`) |
| **Caveman** (style de réponse concis injecté en system prompt, niveaux lite→ultra) | `open-sse/rtk/caveman*.js` | `cavemanEnabled: false`, niveau `full` | Réduit les tokens de **sortie**. Le niveau `lite` garde des phrases complètes |
| **Ponytail** (style « développeur senior paresseux ») | `open-sse/rtk/ponytail*.js` | désactivé | Sortie plus courte sur le code ; plus opinionné que caveman |
| **Headroom** (compression externe des messages, service local `:8787`) | `open-sse/rtk/headroom.js` | désactivé, timeout 3 s | Entrée ; exige un service compagnon — coût/complexité à justifier |
| **pxpipe** (compression des très longs contextes, seuil 25 000 car.) | `open-sse/rtk/pxpipe.js` | désactivé | Entrée sur très gros contextes seulement |
| **Fournisseurs gratuits validés** (health-check A5) | `open-sse/config/freeTierProviders.js` | statut non branché sur le routage | OVHcloud, Mistral, Gemini, OpenRouter **validés le 2026-10-18** (HTTP 200) ; Groq/Cloudflare `untested` (aucune clé) |
| **Combos / fallback multi-modèles** | `src/sse/handlers/chat.js`, réglages `comboStrategy` | `fallback` | Permet de viser un modèle sobre d'abord, un plus fort en repli — à composer manuellement |
| **Suivi d'usage** | `src/lib/usageDb.js` (`~/.9router`) | actif | Mesure par fournisseur/modèle : c'est l'outil de vérification des gains |

Constat principal : **le plus gros levier (RTK) est déjà activé par défaut.**
Les gains restants sont dans les habitudes (modèles sobres, style concis,
budgets de sortie, contextes courts), pas dans un nouveau mécanisme.

## Réglages recommandés (à appliquer manuellement, par profil d'usage)

Profils documentés et testés dans `open-sse/config/tokenSaverProfiles.js`
(opt-in, branchés sur **aucun** routage automatique) :

| Profil | Usage | Réglages | Modèles sobres (exemples registre) | Budget sortie indicatif |
|---|---|---|---|---|
| **éco** | résumé, classification, extraction, triage | RTK on, caveman `lite` | Gemini `gemini-2.5-flash-lite`, Mistral `mistral-medium-latest` | ~1 024 tokens |
| **équilibré** | code courant, rédaction | RTK on, caveman `lite` | Gemini `gemini-2.5-flash`, Mistral `mistral-medium-latest` | ~4 096 tokens |
| **qualité** | architecture, sécurité, décision | RTK on, pas de style forcé | Gemini `gemini-2.5-pro`, Mistral `mistral-large-latest` | ~8 192 tokens |

Règles d'hygiène associées (côté client Claude Code, voir le guide du volet A) :
historique court, `/clear` par tâche, `/compact` avant saturation, budgets
`max_tokens` explicites plutôt que le maximum du modèle, et petits modèles
d'abord avec repli qualité via combo — jamais l'inverse.

## Ce qui n'est PAS fait, volontairement

- **Aucun branchement du statut `valid` sur le routage automatique** : décision
  Christophe « non en l'état » (conditions du ménage global d'abord).
- Pas d'activation de headroom/pxpipe : services compagnons, gain non mesuré ici.
- Groq et Cloudflare restent hors profils : non testés, aucune clé (4 fournisseurs suffisent).
- Aucun modèle ajouté au registre : les exemples cités existent déjà dans
  `open-sse/providers/registry/` ou sont à confirmer dans le dashboard.

## Tests

- Nouveau : `tests/unit/token-saver-profiles.test.js` (4 tests) — les profils ne
  référencent que les 4 fournisseurs validés, jamais Groq/Cloudflare, RTK
  toujours recommandé, budgets croissants éco < qualité.
- Non-régression : suites RTK et health-check existantes rejouées et comparées
  à la baseline connue du dépôt (voir mémoire projet dans CLAUDE.md).
