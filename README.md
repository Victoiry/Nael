# ⚡ JARVIS — l'IA que tout le monde souhaiterait avoir

Assistant IA personnel : **voix temps réel, vision, images, vidéos, mémoire, et agent capable d'agir sur votre PC**.
Site entièrement disponible en **Français · English · Español · Italiano**.

> Créateur : **Nael Hamouche** — nael.hamouche@gmail.com

---

## 🚀 Démarrage

```bash
node server/index.js        # aucune dépendance npm requise
# → http://localhost:8787
```

Le serveur écoute sur `0.0.0.0` (port `PORT` si défini). Tout le site (pages, styles, scripts) est servi par ce serveur.

## 🧭 Parcours utilisateur

1. **Accueil** — « Ayez l'IA que tout le monde souhaiterait avoir : JARVIS » + bouton **Commencer**.
2. **Sans compte** — on peut tout utiliser sans créer de compte (tout reste dans le navigateur). Un compte (optionnel) synchronise réglages, historique et mémoire.
3. **3 étapes OpenRouter** — création de la clé API expliquée pas à pas (avec lien direct vers `openrouter.ai/keys`).
4. **Test avant enregistrement** — pop-up verticale « Quel modèle voulez-vous tester ? » :
   - ⚠ **en gras et rouge** : les modèles qui ne contiennent pas `/free` ou `:free` sont **payants** ;
   - bouton **Plus d'infos** → documentation OpenRouter (payants / gratuits / tarifs) ;
   - **liste 100 % issue de l'API OpenRouter** (aucun modèle pré-écrit) : payants en premier, badge `FREE` / `PAID`, contexte, vision, prix au million de tokens ;
   - si le modèle choisi est payant → pop-up d'avertissement avec **compte à rebours de 5 s** avant de pouvoir lancer le test.
   - la clé n'est enregistrée **qu'après un test réussi**.
5. **Fichier à exécuter** — téléchargement de `JARVIS-Setup.bat` : il installe **Claude Code CLI**, le lie à **OpenRouter** (modèle gratuit choisi) **et à ce site**. Il affiche un **numéro de vérification aléatoire**, à recopier dans le site : la liaison est vérifiée automatiquement (et manuellement via le champ prévu).
6. **L'application** — interface **type ChatGPT**, volontairement dépouillée : barre latérale de conversations à gauche, chat centré, barre de saisie compacte, **aucun emoji** (uniquement des icônes SVG, `public/js/icons.js`). Tous les réglages avancés sont rangés derrière l'**icône engrenage** (tiroir à droite : Personnaliser · Paramètres globaux · Paramètres de l'IA · Modes · Historique · Mémoire · Console · Pont local). Les modes (Multitâche, Comparaison, Code, Privé, Hors connexion, Image, Vidéo) et le contexte (RAG, fichiers, skills) sont dans le bouton **+** de la barre de saisie.

## 🔌 Branchement OpenRouter (trois canaux, bascule automatique)

| Canal | Rôle |
|---|---|
| `server/lib/openrouter.js` **(serveur)** | catalogue live, test de clé, streaming SSE, images, crédits (**`OPENROUTER_BASE`** permet de pointer un proxy/auto-hébergement) |
| `public/js/openrouter.js` **(navigateur)** | si le serveur n'a pas accès à `openrouter.ai`, l'app parle directement à l'API depuis le navigateur (le même code, les mêmes erreurs explicites) |
| `POST /api/or-relay` + `bridge/runner.js` **(pont local)** | si **ni** le serveur **ni** le navigateur ne peuvent joindre `openrouter.ai` : l'appel est exécuté par le `.bat` installé sur **votre** ordinateur, puis renvoyé à la page. Seules les URL de l'API OpenRouter sont autorisées, et uniquement pour un pont appairé. |

L'ordre d'essai est `serveur → navigateur → pont local` ; le badge du panneau « Connexion OpenRouter » indique le canal réellement utilisé ("via votre PC" pour le relais).

- `GET /api/models` → **toujours** l'API OpenRouter ; en cas d'échec réseau la réponse est `offline:true` et le navigateur prend le relais (jamais de fausse liste).
- `GET /api/or-probe` → le serveur joint-il OpenRouter ? (affiché dans Réglages → Paramètres de l'IA)
- `POST /api/chat`, `/api/chat-once`, `/api/image`, `/api/test-key` → erreurs typées : `cle_invalide` (401), `credit` (402), `refuse` (403), `modele_inconnu` (404), `debit` (429), `reseau_ou_cors`.
- Gratuit/payant n'est plus deviné : un modèle est gratuit si **ses tarifs renvoyés par l'API valent 0** (ou identifiant `:free` / `/free`).

## 🧠 Fonctionnalités

| Domaine | Détail |
|---|---|
| **Chat** | Streaming, raisonnement affiché, copie, relance, historique, mémoire |
| **Onglets** | Classique · Multitâche (4 chats) · Comparaison (2 modèles) · Code · **Privé** (aucune trace) · Hors connexion (Ollama / LM Studio) |
| **Effort** | Économiseur ultra · Mini · Normal · **Haut · Très haut · Max · Ultra** (avertissement : ça épuise les tokens) ; en dessous de Normal, moins de tokens et plus rapide |
| **Voix** | Bouton micro (survol = « Vocal »), dictée dans la barre, réponse parlée, boucle vocale continue |
| **Live** | Caméra + micro, l'IA voit (si le modèle gère la vision) et répond à la voix ; avertissement automatique pour les modèles sans vision |
| **Contexte (+)** | **RAG** : 5 fichiers, 5 pages web, 5 notes · **Fichiers simples** : 3 max par prompt · **Skills** : prédéfinis ou créés par vous |
| **Image** | Interface dédiée : qualité (6 niveaux), résolution, format, pixels (max 3 072), palette, style, **mode pro** (négatif, graine, guidage, éclairage, objectif, ambiance), image **interactive** (filtres en direct), variations, galerie, export PNG |
| **Vidéo** | Qualité, durée, fps, mouvement, résolution, couleurs ; assemblage des images clés en vidéo `.webm` téléchargeable |
| **Personnalisation** | Plusieurs **profils de réglages nommés** (ex. « Informatique »), nom de l'IA (elle le sait), personnalité, ton, instructions, comment elle vous appelle, votre nom/profession, langue, interdictions, avatar, voix (voix, vitesse, hauteur) |
| **Réglages globaux** | Langue du site, thème (sombre/clair/néon), couleurs, fond (dégradé/image/vidéo/particules), verre, densité, arrondis, police, taille, animations |
| **Réglages IA** | Créativité, tokens max, streaming, défilement, Entrée = envoyer, mode compact, mode privé par défaut, lecture vocale, langue de reconnaissance, mot d'activation, avertissement vision, clé & modèle |
| **Données** | Historique (export/effacer), Mémoire (ajout/suppression), Console agent, Pont local |

## 🖥️ Agent sur votre PC — 3 modes d'autorisation

Avant toute commande, l'IA **demande** ; vous pouvez **Refuser**, **Accepter**, ou **Toujours accepter ce type** (ex. tous les `nano …`).

1. **Demander mon approbation** — chaque action est validée.
2. **Autoriser les commandes sans risque** — lecture seule (`ls`, `pwd`, `git status`…) autorisée, le reste demande.
3. **Autoriser toutes les commandes** — pop-up de 5 s expliquant les risques + clause de non-responsabilité ; tout s'exécute ensuite sans confirmation.

L'IA peut : exécuter des commandes, lire/écrire des fichiers, lister un dossier, ouvrir une URL, **prendre un screenshot et vous l'afficher**, chercher sur le web, ajouter un rendez-vous (si un service calendrier est connecté). Le mode Chat n'exécute rien : il faut être en **mode Agent** (choix en haut de la page d'accueil).

## 🗂️ Structure

```
server/
  index.js              API HTTP + SSE + fichiers statiques (zéro dépendance)
  lib/openrouter.js     catalogue, test de clé, streaming, images
  lib/agent.js          prompts système, outils, niveaux d'effort
  lib/security.js       classification des risques, familles de commandes
  lib/router-tasks.js   approbations, salles d'attente, allowlist
  lib/auth.js           comptes (scrypt) + jetons signés
  lib/store.js          stockage JSON (server/data, ignoré par git)
bridge/
  install-windows.bat.tpl  Claude Code CLI + OpenRouter + liaison du site
  access-key.bat.tpl       raccourci Claude Code via le site
  runner.js                pont local : exécute les tâches approuvées
public/
  index.html · css/app.css
  js/i18n.js            FR / EN / ES / IT (toutes les chaînes)
  js/i18n.extra.js      compléments de traduction (studio image/vidéo, réglages)
  js/icons.js           jeu d'icônes SVG (aucun emoji dans l'interface)
  js/core.js            état, thème, i18n, API/SSE, markdown, voix
  js/settings.js        panneaux Personnaliser / Global / IA / Historique / Mémoire / Console / Pont
  js/chat.js            chat, effort, modèles, vocal, live, RAG, skills, onglets
  js/media.js           studios image & vidéo
  js/app.js             accueil, clé, test modèle, .bat, vérification, espace de travail
tools/                  tests : smoke (jsdom), verify-layout, verify-app, verify-i18n-ui, verify-stale, doctor
legacy/                 ancien projet « garcon runner »
```

## 🔒 Confidentialité

Mode privé : aucune trace (ni historique, ni mémoire, ni logs, contexte oublié à la fermeture).
Les clés API restent dans votre navigateur (ou dans votre compte si vous vous connectez) — jamais affichées à un tiers.

## 🔑 Compte : optionnel (jamais imposé)

- **Aucun compte n'est nécessaire** : au lancement, une session invitée silencieuse sert au pont local et aux `.bat` (le code de vérification et le téléchargement du `.bat` fonctionnent sans compte).
- Le compte sert uniquement à **synchroniser** mémoire / historique / réglages entre appareils. La fenêtre de connexion s'ouvre par défaut sur « Se connecter » ; « Créer le compte » est un onglet, pas une obligation.
- La connexion n'est annoncée **qu'après vérification du jeton par le serveur** (`/api/auth/me`) : plus de « connecté » sans l'être. La pastille du profil indique `Synchronisé` ou `Local`.
- Fenêtre de clé OpenRouter : **un seul bouton** — « Tester » — qui devient **« Test OK »** après un test réussi ; la clé n'est enregistrée qu'à ce moment-là.

## 🧪 Tests

Guide complet : **[TESTING.md](TESTING.md)**

```bash
node tools/doctor.js                                            # diagnostic (Node, réseau, serveur, pont)
node tools/verify-server-or.js                                  # canal serveur : faux OpenRouter local, catalogue/tests/SSE
node tools/verify-openrouter.js                                 # canal navigateur : API interceptée (liste, 401, 429, 402, streaming)
node tools/verify-clicks.js                                     # clique toute l'interface et vérifie qu'aucun clic ne casse
node tools/verify-buttons.js                                    # CHAQUE bouton doit produire un effet (aucun bouton mort, aucune invite native)
node tools/verify-relay.js                                      # canal « pont local » : protocole + bascule automatique du navigateur
node tools/verify-flow.js                                       # parcours réel : accueil → sans compte → envoi → réponse → panneau → 4 langues
node tools/verify-auth.js                                       # connexion réelle, session persistante, aucun compte obligatoire, un seul bouton « Tester » → « Test OK »
node tools/verify-surface.js                                    # audit statique : aucun appel mort, aucun élément manquant, aucun helper non importé
node --check server/index.js && node --check bridge/runner.js   # syntaxe
npm i --no-save jsdom && node tools/smoke.js                    # parcours front complet (jsdom)
```

---

### English (short)

**JARVIS** is a full personal AI assistant: real-time voice, live camera, image & video generation, RAG, skills, memory, history, 4 languages (FR/EN/ES/IT) and a **PC agent** that asks for approval before every command (3 authorisation modes). Paste your **OpenRouter** key, **test it before saving** (paid models are flagged in bold red, free ones contain `/free` or `:free`), download the `.bat` that installs **Claude Code CLI** and links it to OpenRouter and to this site, then paste the random verification number. Creator: **Nael Hamouche** — nael.hamouche@gmail.com.
