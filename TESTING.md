# 🧪 Comment tester JARVIS

Deux façons de tester : **dans l'aperçu en ligne** (rapide, mais sans accès à OpenRouter) ou **sur votre PC** (test complet, recommandé).

---

## ⚡ Option 1 — Test rapide dans l'aperçu en ligne

L'aperçu (panneau à droite) affiche déjà le site en direct. Vous pouvez vérifier :

- la page d'accueil et la phrase « Ayez l'IA que tout le monde souhaiterait avoir : JARVIS » ;
- le bouton **Commencer** → pop-up des 3 étapes OpenRouter ;
- **Changer la langue** (français / English / Español / Italiano) en haut à droite ;
- les onglets **Personnaliser / Paramètres globaux / Paramètres IA / Historique / Mémoire / Console agent / Pont local** ;
- le **redimensionnement du panneau** (glissez la petite barre entre le chat et le panneau de droite, double-clic = 25 %) ;
- la pop-up « Quel modèle voulez-vous tester ? » avec l'**avertissement en rouge** : la liste s'affiche en mode secours ;
- les boutons du bas : Image, Vidéo, Multitâche, Comparaison, Code, Privé, Hors connexion.

> ⚠️ **Limite de l'aperçu** : le bac à sable n'a **pas d'accès réseau vers `openrouter.ai`**. Le test de clé, les modèles, le chat et les images y renverront une erreur réseau. Ce n'est pas un bug de JARVIS — faites l'option 2 pour le test réel.

---

## 💻 Option 2 — Test complet sur votre PC (recommandé)

### 1. Installer Node.js
Téléchargez **Node.js LTS** : https://nodejs.org (v18 minimum, v22 conseillé). Aucun autre paquet n'est nécessaire.

### 2. Récupérer le projet
```bash
git clone https://github.com/Victoiry/Nael.git
cd Nael
git checkout arena/01a0d38c-nael
```
(sinon : bouton **Code → Download ZIP** sur GitHub, puis décompressez)

### 3. Lancer le serveur
```bash
node server/index.js
```
→ Ouvrez **http://localhost:8787**

Diagnostic en un coup d'œil :
```bash
node tools/doctor.js
```
(il vous dit si Node est bon, si `openrouter.ai` est joignable, si le serveur et le pont local répondent)

### 4. Créer et coller votre clé OpenRouter
1. https://openrouter.ai → **Sign in** → menu du compte → **Keys** → **Create Key** ;
2. copiez la clé (`sk-or-v1-…`) ;
3. dans le site : **Commencer** → collez la clé → **Tester et enregistrer**.

### 5. Tester l'enregistrement du modèle
- La pop-up **« Quel modèle voulez-vous tester ? »** s'ouvre : les **payants sont en premier**, les gratuits portent `🆓 FREE` (`/free` ou `:free`).
- Cliquez un modèle **gratuit** → **Tester ce modèle** → vous devez voir **« Connexion réussie ✔ »** avec la latence.
- Refaites l'essai sur un modèle **payant** : la pop-up rouge doit afficher un **chrono de 5 secondes** avant de pouvoir cliquer.
- **Rien n'est enregistré si le test échoue** (mettez volontairement une fausse clé pour le vérifier).

### 6. Tester le fichier `.bat` et le numéro de vérification
1. Cliquez **Télécharger JARVIS-Setup.bat** ;
2. un numéro à 6 chiffres s'affiche **dans le site et dans la fenêtre noire** → ils doivent être identiques ;
3. le script installe **Claude Code CLI**, le relie à **OpenRouter** et à votre site, puis ouvre une fenêtre qui affiche le numéro ;
4. laissez la fenêtre noire ouverte : le site passe à **« Liaison confirmée ✔ »** tout seul (ou collez le numéro et cliquez **Vérifier**).

### 7. Tester le chat et la voix
- Écrivez « Bonjour, qui es-tu ? » → la réponse arrive en direct (**streaming**).
- Bouton **⚙ effort** : choisissez **Ultra** → un avertissement « ça épuise vos tokens » doit apparaître.
- Bouton **micro** → parlez : votre phrase s'écrit dans la barre, puis l'IA répond **à voix haute**.
- Bouton **Live** → autorisez la caméra et parlez : l'IA décrit ce qu'elle voit (si le modèle gère la vision, sinon un avertissement s'affiche).
- Bouton **+** → **RAG** (5 fichiers / 5 pages web / 5 notes), **Fichier simple** (3 max), **Skills** (prédéfinis ou créés par vous).
- 🖼️ **Image** : choisissez la qualité (6 niveaux), les pixels (max 3 072), les couleurs, activez **mode pro**, générez, puis jouez avec les curseurs **interactifs** (luminosité, contraste, teinte…) et téléchargez en PNG.
- 🎬 **Vidéo** : durée, fps, mouvement → génère un `.webm` téléchargeable.

### 8. Tester l'agent sur le PC (le plus important)
1. En haut, choisissez **🤖 Mode Agent** ;
2. demandez : « **liste les fichiers de mon dossier Téléchargements** » ;
3. une pop-up s'ouvre avec la commande → testez les 3 boutons :
   - **Refuser** → l'IA répond qu'elle n'a pas exécuté la commande ;
   - **Accepter** → la commande s'exécute, le résultat revient dans le chat ;
   - **Toujours accepter ce type** → toutes les commandes du même genre passeront seules (vérifiez dans **Pont local → Commandes toujours autorisées**) ;
4. demandez un **screenshot** → l'image de votre écran s'affiche dans le chat ;
5. essayez les 3 modes d'autorisation dans **Paramètres globaux → Commandes sur le PC** :
   - **Demander mon approbation** (par défaut),
   - **Autoriser les commandes sans risque** (`ls`, `pwd`, `git status`… passent seules),
   - **Autoriser toutes les commandes** → pop-up de 5 s « nous déclinons toute responsabilité » avant validation.

### 9. Tester le reste
- **Comparaison** : même question envoyée à 2 modèles côte à côte.
- **Multitâche** : 4 chats indépendants.
- **Privé** : discutez, rechargez la page → la conversation doit avoir disparu (aucun historique, aucune mémoire).
- **Hors connexion** : lancez `ollama serve` → **Détecter les modèles locaux**.
- **Compte** : créez un compte, déconnectez-vous, reconnectez-vous → réglages, historique et mémoire sont retrouvés.
- **Personnaliser** : créez un profil « Informatique », nommez l'IA (elle utilisera ce nom), changez la personnalité, la façon dont elle vous appelle, la voix.

---

## ✅ Checklist express

| # | À vérifier | Attendu |
|---|---|---|
| 1 | `node tools/doctor.js` | Node ✅, serveur ✅, réseau OpenRouter ✅ |
| 2 | Clé collée puis testée | « Connexion réussie ✔ » + latence |
| 3 | Modèle payant | pop-up rouge + **5 s** d'attente |
| 4 | `.bat` exécuté | même numéro dans la fenêtre et sur le site |
| 5 | Vérification | « Liaison confirmée ✔ » automatiquement |
| 6 | Chat | réponse en streaming |
| 7 | Effort Ultra | avertissement tokens |
| 8 | Micro | texte dicté + réponse parlée |
| 9 | Mode Agent | pop-up avec Refuser / Accepter / Toujours |
| 10 | 4 langues | toute l'interface traduite |

## 🆘 Si ça bloque

| Symptôme | Solution |
|---|---|
| `openrouter.ai … ÉCHEC` dans le doctor | Antivirus/pare-feu ou VPN : autorisez le domaine, ou testez depuis un autre réseau |
| « Le pont local ne répond pas encore » | Laissez la fenêtre noire du `.bat` ouverte ; vérifiez que `node` est installé (`node -v`) |
| Modèles vides | Clé invalide ou sans crédit → recréez une clé sur openrouter.ai |
| Pas de voix | Utilisez **Chrome** ou **Edge** (la reconnaissance vocale n'existe pas sur Firefox) |
| Port déjà pris | `PORT=8788 node server/index.js` (Windows : `set PORT=8788 && node server/index.js`) |

---

Créateur : **Nael Hamouche** — nael.hamouche@gmail.com
