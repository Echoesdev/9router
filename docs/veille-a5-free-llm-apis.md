# Veille A5 — Fournisseurs LLM gratuits compatibles OpenAI, adaptés à un usage EU

> **Statut : documentation uniquement (2026-10-17, Europe/Berlin).**
> Aucun fournisseur n'est branché dans 9Router par ce document, aucune clé API
> n'a été créée, lue ou commitée, et aucun code n'a été modifié.
> Décision requise de Christophe avant tout branchement : voir « Décision demandée ».

Source primaire vérifiée le 2026-10-17 : le README de
[mnfst/awesome-free-llm-apis](https://github.com/mnfst/awesome-free-llm-apis),
qui recense les API LLM à palier gratuit permanent et précise que leurs
endpoints sont compatibles avec le SDK OpenAI sauf mention contraire.
Les limites gratuites évoluent sans préavis : toujours revérifier les quotas
dans la console du fournisseur avant tout usage réel.

## Avertissement données — à lire avant tout test

> **Aucune donnée client sensible sur ces paliers gratuits sans revue des
> conditions par Christophe.**
>
> Cela vaut pour tous les fournisseurs ci-dessous, y compris ceux hébergés
> dans l'UE : données personnelles identifiantes, documents clients,
> secrets, code propriétaire non publié et contenus couverts par un engagement
> contractuel ne doivent pas transiter par un palier gratuit tant que les
> conditions d'utilisation, la politique d'entraînement sur les données,
> la rétention et la localisation n'ont pas été revues et approuvées.
> Par défaut : tests avec des données fictives ou publiques uniquement.

## Sélection (6 fournisseurs réellement listés dans la source)

### 1. OVHcloud AI Endpoints 🇫🇷 — le plus adapté EU, quotas minuscules

- **Base URL (source)** : `https://oai.endpoints.kepler.ai.cloud.ovh.net/v1`
- **Limites gratuites connues** : palier anonyme permanent, sans inscription ni
  clé : 2 requêtes/minute par IP et par modèle, 20+ modèles open-weight
  hébergés dans des data centers UE. Le palier supérieur (400 RPM par projet
  Public Cloud) est payant à l'usage.
- **Risques / conditions** : le palier anonyme n'offre ni clé, ni quota garanti,
  ni SLA ; l'IP partagée peut saturer les 2 RPM. Conditions d'entraînement et
  de rétention non détaillées dans la source : à vérifier dans les conditions
  OVHcloud avant tout usage au-delà du prototype.
- **Recommandation** : **premier choix EU pour prototyper** (hébergement UE,
  aucun compte requis), inutilisable en production à ce quota.

### 2. Mistral AI 🇫🇷 — fournisseur européen, entraînement par défaut en gratuit

- **Base URL (source)** : `https://api.mistral.ai/v1`
- **Limites gratuites connues** : mode gratuit activé par défaut, sans carte ;
  10 $/mois de crédits API selon la source (budget partagé Studio/API/CLI).
  Mistral ne publie plus de limites chiffrées : la source conserve les
  derniers chiffres publiés (~1 RPS, 500K TPM), à confirmer dans le panneau
  Limits de la console.
- **Risques / conditions** : **en mode gratuit, les entrées et sorties peuvent
  être utilisées pour entraîner les modèles Mistral, sauf désactivation
  (opt-out) à tout moment** (source, note 13). Usage commercial à confirmer
  dans les conditions du plan gratuit après opt-out.
- **Recommandation** : **premier choix EU pour un usage réel futur**, à la
  condition expresse de vérifier l'opt-out entraînement et les conditions
  commerciales avant le moindre branchement.

### 3. Google Gemini 🇺🇸 — généreux, mais clause EEA à risque juridique

- **Base URL (source)** : `https://generativelanguage.googleapis.com/v1beta`
  (vérifier la variante d'endpoint compatible OpenAI dans le provider 9Router
  existant avant tout branchement).
- **Limites gratuites connues** : palier gratuit sans carte. Chiffres de la
  source à titre indicatif (Google ne publie plus les limites par modèle,
  quotas visibles dans AI Studio) : Flash ~15 RPM / 1 500 RPD,
  Flash-Lite ~30 RPM / 1 500 RPD, Pro ~5 RPM / 50 RPD.
- **Risques / conditions** : **deux risques majeurs pour un usage EU** —
  (a) hors EEE/Suisse/Royaume-Uni, les prompts du palier gratuit peuvent être
  utilisés par Google pour améliorer ses produits ; dans l'EEE, ce sont les
  conditions des services payants qui s'appliquent aux prompts ;
  (b) ces mêmes conditions exigent d'utiliser uniquement les services payants
  lorsqu'un client API est mis à disposition d'utilisateurs dans l'EEE, la
  Suisse ou le Royaume-Uni (source, note 1). Un usage gratuit exposé à des
  utilisateurs finaux EU peut donc violer les conditions.
- **Recommandation** : acceptable pour des **tests internes non sensibles** ;
  **ne pas autoriser** pour un service exposé à des utilisateurs EU sans revue
  juridique des conditions par Christophe.

### 4. Cloudflare Workers AI 🇺🇸 — quota quotidien confortable, conditions à vérifier

- **Base URL (source)** : `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run`
  (vérifier la variante compatible OpenAI avant tout branchement).
- **Limites gratuites connues** : 10 000 Neurons/jour gratuits, sans carte,
  partagés entre tous les modèles (60+) et remis à zéro à 00:00 UTC ;
  au-delà, la requête échoue (pas de facturation surprise). Sept modèles
  récents sont exclus du palier gratuit (liste dans la source, note 11).
- **Risques / conditions** : la source ne précise ni rétention, ni entraînement,
  ni garantie de traitement dans l'UE : à vérifier dans les conditions
  Cloudflare et les éventuels réglages de localisation avant autorisation.
- **Recommandation** : bon candidat **tests et prototypage** ; autorisation
  production seulement après revue des conditions de données.

### 5. Groq 🇺🇸 — très rapide, quotas par modèle, conditions données à vérifier

- **Base URL (source)** : `https://api.groq.com/openai/v1`
- **Limites gratuites connues** : palier gratuit sans carte ; modèles de chat
  listés à 30 RPM / 1 000 RPD. Les limites varient par modèle et les modèles
  sont dépréciés régulièrement (exemples datés dans la source, note 2) :
  revérifier la page Rate limits et les dépréciations.
- **Risques / conditions** : la source ne documente pas la politique
  d'entraînement/rétention du palier gratuit : à vérifier dans les conditions
  Groq avant autorisation. Hébergement non-UE à confirmer.
- **Recommandation** : candidat **performance/latence pour tests** ; pas
  d'usage sur données réelles sans revue des conditions par Christophe.

### 6. OpenRouter (`:free`) 🇺🇸 — catalogue large, risque d'enregistrement le plus élevé

- **Base URL (source)** : `https://openrouter.ai/api/v1`
- **Limites gratuites connues** : 17 modèles marqués `:free` dans la source ;
  20 RPM / 50 RPD par modèle en gratuit. Un achat unique de 10 $+ de crédits
  porte les modèles gratuits à 1 000 RPD.
- **Risques / conditions** : **les fournisseurs gratuits derrière OpenRouter
  peuvent enregistrer les prompts pour l'entraînement** (source). Le routage
  peut changer de fournisseur sous-jacent, donc de conditions, sans changement
  de modèle apparent.
- **Recommandation** : **réserver à la découverte et aux tests sur données
  fictives/publiques**. Ne pas autoriser pour des données clients, même non
  sensibles, sans décision explicite de Christophe.

## Synthèse

| Fournisseur | Ancrage | Quota gratuit (source) | Risque principal | Avis |
|---|---|---|---|---|
| OVHcloud AI Endpoints | 🇫🇷 UE | 2 RPM/IP/modèle, anonyme | Quota minuscule, pas de SLA | Prototypage EU n°1 |
| Mistral AI | 🇫🇷 UE | ~10 $/mois, limites non publiées | Entraînement sauf opt-out | Réel futur, après opt-out vérifié |
| Google Gemini | 🇺🇸 | ~15 RPM / 1 500 RPD (Flash) | Clause EEE services payants + entraînement hors EEE | Tests internes seulement |
| Cloudflare Workers AI | 🇺🇸 | 10 000 Neurons/jour | Conditions données non documentées dans la source | Tests/prototypage après revue |
| Groq | 🇺🇸 | 30 RPM / 1 000 RPD | Conditions données à vérifier, dépréciations | Tests performance |
| OpenRouter `:free` | 🇺🇸 | 20 RPM / 50 RPD/modèle | Prompts possiblement enregistrés pour entraînement | Découverte, données fictives |

## Décision demandée

Christophe doit indiquer, fournisseur par fournisseur :

1. lesquels sont **autorisés pour tests sur données fictives/publiques**
   (suggestion : OVHcloud, Mistral après opt-out, Cloudflare, Groq, Gemini
   en interne, OpenRouter `:free` en découverte) ;
2. lesquels sont **interdits** tant qu'une revue des conditions (entraînement,
   rétention, localisation, usage commercial, clause EEE pour Gemini) n'a
   pas été faite et archivée ;
3. si un branchement ultérieur dans 9Router est souhaité — ce sera un autre
   chantier, avec sa propre branche, ses tests et sa revue sécurité
   (stockage des clés, fuites, SSRF) conformément à `CLAUDE.md`.

## Sources

- mnfst/awesome-free-llm-apis, README (vérifié le 2026-10-17) :
  https://github.com/mnfst/awesome-free-llm-apis — sections Gemini (note 1),
  Groq (note 2), OpenRouter (note 4), OVHcloud AI Endpoints (note 7),
  Cloudflare Workers AI (note 11), Mistral AI (note 13).
- Les liens vers les pages officielles quotas/conditions de chaque fournisseur
  sont ceux cités en notes de bas de page de cette source ; ils restent à
  revérifier au moment de la décision, les paliers gratuits changeant sans
  préavis.
