# ⚡ JARVIS — test express (2 minutes, sans rien installer)

Vous avez le lien de l'aperçu envoyé par Arena (il ressemble à `https://8787-xxxxxxxx.e2b.app`).

## ⚠️ Important : après une mise à jour, votre navigateur garde l'ancienne page
L'onglet de l'aperçu reste en mémoire : un simple F5 peut réafficher l'ancienne version (c'est ce qui a montré des textes comme `lp.cta`).
La nouvelle version **se recharge toute seule** (`?v=…`) et affiche un bouton **⟳ Recharger** si besoin.
Si jamais : **fermez l'onglet** puis rouvrez le lien, ou **Ctrl+Shift+R**. Le badge en bas doit indiquer **v2.0**.

## Étape 1 — Ouvrez le lien
Vous devez voir** obligatoirement** en bas de la page le badge vert **v1.1**.

| Ce que vous voyez | Ce que ça veut dire |
|---|---|
| Badge **v1.1** en bas | ✅ vous avez la bonne version → passez à l'étape 2 |
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
