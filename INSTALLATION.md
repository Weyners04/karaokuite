# 🎤 Monter ton propre Karaokuite

Guide pas-à-pas pour avoir **ta propre installation de Karaokuite**, avec **ta propre
application Spotify**. Le gros avantage : comme tu es le **propriétaire** de ton app
Spotify, tu peux l'utiliser directement, sans la limite des 5 utilisateurs du mode
développement. Fini l'erreur `403 — The user is not registered for this application`.

⏱️ Compte **~10 minutes**. Pas besoin d'être développeur, il suffit de suivre les étapes.

---

## ✅ Ce qu'il te faut

- Un **compte Spotify Premium** (obligatoire pour la lecture audio ; la recherche seule
  marche sans Premium, mais le jeu coupe/relance la musique, donc Premium est nécessaire).
- **Node.js 18+** ([nodejs.org](https://nodejs.org)) **ou** **Docker** ([docker.com](https://www.docker.com)).
  Tu n'as besoin que de l'un des deux.
- Les fichiers de Karaokuite (le dépôt du projet) sur ta machine.

---

## Étape 1 — Créer ton application Spotify

C'est l'étape qui bloque tout le monde, alors on la fait en détail.

1. Va sur le **[dashboard développeur Spotify](https://developer.spotify.com/dashboard)**
   et connecte-toi avec ton compte Spotify.
2. Clique sur **Create app**.
3. Remplis le formulaire :
   - **App name** : `Karaokuite` (le nom n'a aucune importance).
   - **App description** : ce que tu veux, ex. `Karaoké à trous entre amis`.
   - **Redirect URI** : saisis **exactement** ceci, puis clique sur **Add** :
     ```
     http://127.0.0.1:3000/callback
     ```
     > ⚠️ **L'erreur n°1**, c'est de se tromper ici. Spotify n'accepte plus `localhost` :
     > il faut l'IP `127.0.0.1`. Le port (`3000`), le `http://` et le `/callback` doivent
     > correspondre **au caractère près** à ce que l'app utilise.
   - **Which API/SDKs are you planning to use** : coche **Web API** **et**
     **Web Playback SDK**.
4. Accepte les conditions, puis **Save**.
5. Ouvre ton app → **Settings**. Tu y trouves :
   - Le **Client ID** (visible directement).
   - Le **Client Secret** : clique sur **View client secret** pour l'afficher.

   Garde ces deux valeurs sous la main pour l'étape suivante. **Ne les partage avec
   personne** et ne les mets jamais sur un dépôt public.

> ✅ Comme tu es le créateur de l'app, **tu n'as rien à ajouter dans « User Management »** :
> le propriétaire peut toujours utiliser sa propre app. Cette liste (5 max) ne sert qu'à
> autoriser **d'autres** personnes sur **ton** app.

---

## Étape 2 — Configurer Karaokuite

Dans le dossier du projet, crée ton fichier de configuration à partir de l'exemple :

```bash
cp .env.example .env
```

Puis ouvre `.env` et remplis-le avec les valeurs de l'étape 1 :

```bash
SPOTIFY_CLIENT_ID=colle_ici_ton_client_id
SPOTIFY_CLIENT_SECRET=colle_ici_ton_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
PORT=3000
```

> ⚠️ `SPOTIFY_REDIRECT_URI` doit être **identique** à la Redirect URI déclarée dans le
> dashboard à l'étape 1. Si les deux diffèrent, Spotify refuse la connexion.

---

## Étape 3 — Lancer Karaokuite

Choisis **une** des deux méthodes.

### Option A — Avec Node.js

```bash
npm install
npm start
```

### Option B — Avec Docker (rien à installer à part Docker)

```bash
docker compose up -d --build
```

Dans les deux cas, ouvre ensuite ton navigateur sur :

```
http://127.0.0.1:3000
```

---

## Étape 4 — Jouer

1. Ajoute au moins un participant, puis va dans **Paramètres**.
2. Choisis **Se connecter à Spotify** → tu es redirigé vers Spotify pour autoriser l'app,
   puis ramené sur Karaokuite. Comme c'est **ton** app, ça marche du premier coup.
3. Lance ta soirée 🎉

**Qui a besoin de quoi ?** Tout se joue sur l'**écran de l'hôte** (la personne qui lance
Karaokuite). Seul l'hôte a besoin d'être connecté à Spotify **Premium**. Les autres
joueurs regardent/écoutent et devinent — ils n'ont **rien** à installer ni à connecter.

---

## 🌍 (Optionnel) Y accéder depuis ailleurs que ta machine

Si tu héberges Karaokuite sur un serveur pour t'y connecter à distance (et pas seulement
en local sur `127.0.0.1`), deux choses changent côté Spotify :

- Ta Redirect URI devient l'URL publique de ton instance, en **HTTPS** (Spotify exige
  `https://` pour toute adresse qui n'est pas `127.0.0.1`), par exemple :
  `https://karaokuite.mondomaine.fr/callback`.
- Déclare cette URL dans le dashboard (**Settings → Redirect URIs**) **et** dans ton
  `.env` (`SPOTIFY_REDIRECT_URI`), toujours à l'identique.

Les joueurs, eux, ne changent rien : ils continuent de jouer sur l'écran de l'hôte.

---

## 🩹 Dépannage

| Message / symptôme | Cause probable | Solution |
|--------------------|----------------|----------|
| `403 — The user is not registered for this application` | Tu utilises l'app Spotify de **quelqu'un d'autre** et tu n'es pas dans sa liste | Crée **ta propre** app (ce guide), ou demande au propriétaire de t'ajouter dans **Settings → User Management** (5 personnes max) |
| `INVALID_CLIENT: Invalid redirect URI` | La Redirect URI ne correspond pas | Vérifie qu'elle est **identique** entre le dashboard et le `.env` : `127.0.0.1` (pas `localhost`), bon port, `/callback`, bon `http`/`https` |
| `Compte non Premium : la lecture Spotify nécessite Premium` | Le compte connecté n'est pas Premium | L'hôte doit utiliser un compte **Spotify Premium** |
| La recherche ne renvoie rien | `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` manquants ou erronés | Revérifie les deux valeurs dans `.env` (copie depuis **Settings** du dashboard) |
| Rien ne se passe après « Se connecter à Spotify » | Redirect URI ou port incohérents | Assure-toi que l'app tourne bien sur le port de la Redirect URI (`3000` par défaut) |

---

Besoin d'aide ? Le `README.md` du projet détaille les règles du jeu et l'architecture.
