# [veille-a9] Xiaomi MiMo V2.6 pour 9router — etat des lieux et integration

Date : 2026-10-18 (Europe/Berlin). Branche : `feat/veille-a9-mimo-v26`,
empilee sur `feat/veille-a5-healthcheck-fournisseurs` (PR draft #2), elle-meme
sur `feat/veille-a5-free-llm-apis` (PR draft #1). Aucune fusion, aucun
deploiement, routage par defaut inchange. Source veille : fiche A9 de
`/workspace/liste-developpement.md` (ancre `2026-10-16-mimo-v26`) :
« valider V2.6 uniquement, jamais V2.5 ».

## En une phrase : V2.6 vs V2.5

V2.6 (`mimo-v2.6-pro`, `mimo-v2.6-flash`, `mimo-v2.6-pro-ultraspeed`) est la
serie courante qui remplace V2.5 : `mimo-v2.5-pro` et `mimo-v2.5` sont retires
le **21 octobre 2026 a 10:00 (heure de Pekin)** cote API PAYG (doc officielle
Xiaomi « Model Deprecation », page pricing PAYG consultee le 2026-10-18), donc
tout nouveau branchement doit viser V2.6, jamais V2.5.

## Ce que c est (fiche + sources officielles)

- Fournisseur : Xiaomi (MiMo). API compatible OpenAI
  (`https://api.xiaomimimo.com/v1`, cle `sk-...`) et compatible Anthropic
  (`/anthropic/v1/messages`), plus un Token Plan par abonnement
  (cle `tp-...` / `ttp-...`, clusters `token-plan-{sgp,cn,ams}.xiaomimimo.com`,
  cles NON interchangeables avec `sk-...`).
- V2.5-Pro (fiche) : MoE open-source 1,02 T params / 42 B actifs, contexte
  jusqu a 1 M tokens, licence MIT des poids, fort en tool-calling / agents.
  Ces chiffres sont ceux de V2.5 ; la fiche signale elle-meme que la carte HF
  V2.6 n a pas ete rechargee en detail : ne pas les attribuer a V2.6 sans
  verification sur la page modele V2.6.
- Gratuite / conditions : **MiMo API n est pas gratuit.** PAYG (etranger) :
  V2.6-Pro ~0,0036 $/MTok (cache hit) / 0,435 $ (miss) / 0,87 $ (sortie) ;
  V2.6-Flash ~0,0028 / 0,14 / 0,28 $. Token Plan : Lite ~6 $/mois a Max
  ~100 $/mois (annuel -~12 %). Poids MIT gratuits, mais self-host = cluster
  multi-GPU, hors portee PME. Le canal « MiMo Code Free » historique est
  termine (voir registry `mimo-free`, `hidden: true` : « MiMo free API
  service has ended »).
- Contexte projet connu : Projet 9ROUTER avait ignore Xiaomi MiMo car
  « solde 0 » lors du lot du 17/10/2026 18:47. Le test live
  `tests/unit/mimo-free.live.test.js` (canal free, pas l API V2.6) est un
  echec connu / reseau-dependant repertorie dans CLAUDE.md, pas dans
  `tests/__baseline__/known-fails.txt`.

## Ce que 9router savait deja router (avant cette branche)

- `open-sse/providers/registry/xiaomi-mimo.js` : provider `xiaomi-mimo`
  (OAuth + API key) referencait **deja** `mimo-v2.6-pro`,
  `mimo-v2.6-flash`, `mimo-v2.6-pro-ultraspeed` (double route : API cloud
  `sk-`, ou route compte Desktop MiMo par cookie de session), en plus de
  V2.5/V2. Executor dedie `open-sse/executors/xiaomi-mimo.js`, couvert par
  `tests/unit/xiaomi-mimo-executor.test.js` (routage V2.6 deja teste).
- `open-sse/providers/registry/xiaomi-tokenplan.js` : provider
  `xiaomi-tokenplan` (abonnement Token Plan) ne referencait **que V2.5/V2** :
  c etait le trou, alors que la doc officielle Token Plan indique que tous
  les plans supportent `mimo-v2.6-pro` / `mimo-v2.6-flash`.
- Health-check veille-a5 (`open-sse/config/freeTierProviders.js`) : 6
  fournisseurs gratuits ; Xiaomi n y figure pas, a juste titre (payant).

## Verification stockage local (metadonnees uniquement, 2026-10-18)

Lecture via `getProviderConnections({})` (meme mecanisme officiel que le
health-check) : 10 connexions stockees (opencode-zen, gemini, ollama-local,
openrouter, nvidia, mistral, 2 noeuds OpenAI-compatibles). **Aucune connexion
`xiaomi-mimo`, `xiaomi-tokenplan` ou `mimo-*`** : aucune cle MiMo active
n existe donc dans 9Router, aucune valeur de cle n a ete lue ni affichee.
Consequence : aucun appel reel de test n a ete fait (la regle etait
« uniquement si une connexion MiMo active existe deja, prompt fictif
minimal » — condition non remplie), et le « solde 0 » rapporte par Projet
9ROUTER reste l etat suppose du compte PAYG.

## Ce que fait cette branche

1. `open-sse/providers/registry/xiaomi-tokenplan.js` : ajout en tete du
   catalogue Token Plan de `mimo-v2.6-pro`, `mimo-v2.6-pro-claude`
   (variante Claude native, meme motif que `mimo-v2.5-pro-claude`) et
   `mimo-v2.6-flash`. Les entrees V2.5 sont conservees (l amont les sert
   encore jusqu au sunset) mais ne sont plus en tete ni recommandees.
   Aucun nouvel executor : `XiaomiTokenplanExecutor` existant route deja
   par region et par format (OpenAI `/v1/chat/completions`, Claude
   `/anthropic/v1/messages`).
2. `tests/unit/xiaomi-mimo-v26.test.js` (nouveau, reseau simule, aucun
   appel reel) : catalogue V2.6 des deux providers, resolution via
   `providerModels` (`isValidModel`, `getModelTargetFormat`,
   `getProviderModels`), routage d URL Token Plan V2.6 (SGP defaut, AMS,
   variante Claude), et garde-fou : MiMo ne doit pas entrer dans la liste
   des fournisseurs **gratuits** du health-check.
3. Sonde health-check : **volontairement non etendue** a Xiaomi. Le module
   veille-a5 ne valide que des paliers gratuits et marque
   `usableForFreeRouting` ; y ajouter un provider PAYG/abonnement serait
   faux et dangereux pour le routage gratuit. Quand une cle existera, la
   sonde minimale pertinente est deja connue : `GET
   https://api.xiaomimimo.com/v1/models` (le `validateUrl` du registry
   `xiaomi-mimo`) — a ajouter alors comme provider *payant* distinct, pas
   dans `FREE_TIER_PROVIDERS`.
4. Memoire projet : entree ci-dessous dans `CLAUDE.md` (meme branche).

## Branchement pas a pas (quand Christophe decidera)

1. Choisir le mode : PAYG (cle `sk-...`, console
   https://platform.xiaomimimo.com/console/api-keys, recharger le solde —
   aujourd hui suppose a 0) **ou** Token Plan (abonnement 6–100 $/mois,
   cle `tp-...`, page https://mimo.mi.com/token-plan). Achat = decision
   Christophe, aucun cree ici.
2. Dans le dashboard 9Router local : ajouter la connexion `Xiaomi MiMo`
   (cle PAYG, region SGP par defaut) ou `Xiaomi MiMo (Token Plan)` (cle
   Token Plan + region du cluster achete : sgp / cn / ams). Ne jamais
   passer la cle par le chat ni la commiter.
3. Verifier dans le dashboard que `mimo-v2.6-pro` / `mimo-v2.6-flash`
   apparaissent, puis test manuel minimal avec un prompt fictif (aucune
   donnee client), comparer qualite/cout vs Claude et OpenRouter sur
   2–3 taches agents (etape 4 de la fiche, non faite).
4. Ne brancher aucun fallback automatique ni routage par defaut vers MiMo
   sans validation separee ; V2.5 ne doit pas etre choisi pour un nouvel
   usage (sunset 21/10/2026).

## Tests

- Ciblés (2026-10-18, deps reutilisees des worktrees veille-a5) :
  `xiaomi-mimo-v26.test.js` (nouveau, 6 tests), `xiaomi-mimo-executor.test.js`,
  `free-tier-healthcheck.test.js` = **38/38 au vert**.
- Suite complete (2026-10-18) : **3721 passes, 15 echecs, 14 expected-fail,
  99 ignores** (373 fichiers, 3850 tests). Les 15 echecs = exactement les
  echecs connus documentes : 14 de `tests/__baseline__/known-fails.txt`
  (oauth-cursor x8, translator-request-normalization x4, openai-to-claude
  x1, claude-header-forwarding x1) + 1 live `mimo-free.live` (canal free
  termine, reseau-dependant). Fichiers en echec d import connus en plus :
  `db-benchmark` (lowdb absent) et `embeddings.cloud` (dossier `cloud/`
  absent du repo), deja repertories dans `CLAUDE.md`. **Aucun nouvel
  echec.** Artefacts de run nettoyes (snapshots restaures).

## Bloque / decision demandee a Christophe

- **Bloque (argent + cle)** : aucune connexion MiMo stockee, solde PAYG
  suppose a 0. Pour un test reel : creer/recharger une cle (PAYG ou Token
  Plan) et la saisir dans le dashboard — jamais via le chat.
- Decision : (a) PAYG recharge minimale ou Token Plan Lite ~6 $/mois pour
  evaluer V2.6, ou (b) rester en referencement seul (cette branche) en
  attendant un besoin agent/coding concret.
- Risques : dependance cloud Xiaomi / CGU, tarifs et sunset susceptibles
  d evoluer (verifier la console au moment de l achat), benchmarks vendor
  non verifies independamment pour V2.6.
