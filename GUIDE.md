# ⚡ JARVIS — test express (2 minutes, sans rien installer)

Vous avez le lien de l'aperçu envoyé par Arena (il ressemble à `https://8787-xxxxxxxx.e2b.app`).

## ⚠️ Important : après une mise à jour, votre navigateur garde l'ancienne page
L'onglet de l'aperçu reste en mémoire : un simple F5 peut réafficher l'ancienne version (c'est ce qui a montré des textes comme `lp.cta`).
La nouvelle version **se recharge toute seule** (`?v=…`) et affiche un bouton **⟳ Recharger** si besoin.
Si jamais : **fermez l'onglet** puis rouvrez le lien, ou **Ctrl+Shift+R**. Le badge en bas doit indiquer **v2.0**.

## 🆕 Nouveautés de la v2.0 (interface refaite façon ChatGPT)

- **Aucun emoji** : uniquement des icônes vectorielles (nettes et rapides).
- **Espace maximisé** : barre latérale des conversations à gauche, chat centré, barre de saisie compacte.
- **Tous les réglages avancés** sont dans **une seule icône engrenage** (en haut à droite) : Personnaliser · Paramètres globaux · Paramètres de l'IA · Modes et contexte · Historique · Mémoire · Console · Pont local.
- **Modes et contexte** (Multitâche, Comparaison, Code, Privé, Hors connexion, Image, Vidéo, RAG, fichiers, skills) : bouton **+** dans la barre de saisie.
- Modèle **gratuit sélectionné par défaut** : badge `FREE` visible en haut, `PAID` en rouge pour les payants.
- L'écran ne peut plus rester vide : si un fichier manque, un bandeau **⟳ Recharger** apparaît au lieu d'une page blanche.

## 🔌 Si « le lien avec OpenRouter ne marche pas »

JARVIS ne contient **aucune liste de modèles écrite à l'avance** : tout vient de l'API OpenRouter.
Trois canaux sont possibles, et l'application choisit toute seule, dans cet ordre :

| Canal | Quand | Où le voir |
|---|---|---|
| **Serveur JARVIS → OpenRouter** | déploiement normal (le serveur a accès à Internet) | Réglages → **Paramètres de l'IA** → « Connexion OpenRouter » |
| **Votre navigateur → OpenRouter (direct)** | si le serveur n'a pas d'accès Internet (pare-feu, hébergement bloqué) | idem, badge orange |
| **Via votre PC (pont local)** | si l'hébergeur **et** le navigateur sont bloqués : l'appel part de **votre ordinateur** (le `.bat` JARVIS doit être lancé) | idem, badge « via votre PC » |

Pour activer le troisième canal : lancez **JARVIS-Setup.bat** (Réglages → Pont local), recopiez le numéro de vérification, et laissez la fenêtre noire ouverte.
Un bouton **Diagnostic** (Réglages → Paramètres de l'IA) teste les quatre étapes — serveur, navigateur, pont local, clé — et permet de copier le résultat.

En cas d'échec, le message est explicite (401 clé invalide, 402 crédit insuffisant, 429 trop de requêtes, réseau/bloqueur de publicités) avec un bouton **Recharger les modèles** et un lien vers `openrouter.ai/keys`.
Astuce : un **bloqueur de publicités** peut bloquer `openrouter.ai` — désactivez-le pour ce site (ou passez par le pont local, qui n'est pas concerné).

## Étape 1 — Ouvrez le lien
Vous devez voir** obligatoirement** en bas de la page le badge vert **v2.0**.

| Ce que vous voyez | Ce que ça veut dire |
|---|---|
| Badge **v2.0** en bas | ✅ vous avez la bonne version → passez à l'étape 2 |
| Pas de badge, ou pas de bouton **Commencer** | ❌ votre navigateur garde l'ancienne page → **Ctrl+Shift+R** (forcé), ou **Cmd+Shift+R** sur Mac |
| Le texte se chevauche encore | ❌ cache : videz-le (**Ctrl+Shift+Suppr** → Images et fichiers en cache) puis rechargez |

Au besoin, ouvrez une **fenêtre de navigation privée** : c'est le moyen le plus sûr de contourner le cache.

## Étape 2 — HOME
1. Cliquez sur **Commencer** (bouton bleu-violet en bas) → la pop-up « **Brancher votre IA** » s'ouvre avec les **3 étapes** OpenRouter.
2. Sans clé : cliquez **Continuer sans compte** → vous entrez directement dans l'application (chat, réglages, images, agent…).
3. En haut, changez la langue (🇫🇷 FR / 🇬🇧 EN / 🇪🇸 ES / 🇮🇹 IT) : tout le site doit se traduire.

## Étape 3 — À savoir sur l'aperçu
L'aperçu est une petite machine : elle **n'a pas accès à internet vers `openrouter.ai`**. Donc :
- ✅ tout ce qui est visuel, réglages, personnalisation, onglets, studios image/vidéo, historique, mémoire : testable ici ;
- ❌ le test de votre clé, les réponses de l'IA et les images générées : il faut votre PC (voir TESTING.md).

## Étape 4 — Pour aller plus loin sur votre PC
```bash
git clone https://github.com/Victoiry/Nael.git
cd Nael
git checkout arena/01a0d38c-nael
node server/index.js      # → http://localhost:8787
node tools/doctor.js      # diagnostic complet
```
Guide complet : **TESTING.md**.

---
Créateur : **Nael Hamouche** — nael.hamouche@gmail.com
