# 🎤 Karaokuite

Jeu de **karaoké à trous entre amis**, façon _N'oublie pas les paroles_ version soirée.
On choisit un morceau, on mise des gorgées, la musique défile avec les paroles
synchronisées… puis **le son se coupe à un moment aléatoire** et il faut retrouver
les mots masqués.

- **Recherche Spotify** (métadonnées : titre, artiste, durée, pochette)
- **Paroles synchronisées LRCLIB** récupérées **en parallèle** de la recherche
- **Lecteur synchronisé** qui coupe la musique à un timestamp aléatoire et masque les mots
- **Mode démo** intégré : teste tout le mécanisme **sans compte Spotify**

---

## 🎲 Règle du jeu

Avant de lancer, le joueur mise selon sa confiance dans le morceau. **Le nombre de
gorgées misées = le nombre de mots à retrouver** :

| Mise | Mots à trouver |
|------|----------------|
| 1 gorgée | 3 mots |
| 3 gorgées | 5 mots |
| 5 gorgées | 7 mots |

La musique démarre, les paroles défilent. À un instant aléatoire, **le son se coupe**
et une rangée de mots masqués apparaît. Le joueur dit les mots à voix haute, on
**révèle** la réponse, et le groupe tranche :

- **Trouvé** → le joueur distribue ses gorgées aux autres.
- **Raté** → le joueur boit ses gorgées.

Plus tu mises, plus le trou est large : risque / récompense.

---

## 🚀 Démarrage rapide

```bash
npm install
cp .env.example .env      # puis remplis tes identifiants Spotify
npm start                 # http://127.0.0.1:3000
```

Sans configuration Spotify, tu peux quand même cliquer sur **« Essayer le mode démo »**
pour voir tout le mécanisme fonctionner (chanson de test synthétisée, paroles originales).

---

## 🐳 Docker

Alternative à `npm install`/`npm start` : tout tourne dans un conteneur, aucune
installation de Node nécessaire sur la machine hôte.

```bash
cp .env.example .env      # puis remplis tes identifiants Spotify (comme ci-dessous)
docker compose up -d --build   # http://127.0.0.1:3000
```

- Le fichier `.env` n'est **jamais copié dans l'image** — `docker compose` l'injecte
  au démarrage du conteneur via `env_file` (mêmes variables qu'en local).
- `docker compose logs -f` pour suivre les logs, `docker compose down` pour arrêter.
- Après une modif du code : relance simplement `docker compose up -d --build`.

---

## 🔑 Configuration Spotify

La **recherche** et la **lecture** utilisent l'API Spotify. Il faut créer une application
(gratuit) :

1. Va sur le [dashboard développeur Spotify](https://developer.spotify.com/dashboard) et
   crée une application.
2. Récupère le **Client ID** et le **Client Secret** → mets-les dans `.env`.
3. Dans les **Redirect URIs** de l'app, ajoute **exactement** :
   `http://127.0.0.1:3000/callback`
   > ⚠️ Spotify n'accepte plus `localhost` : utilise bien l'IP `127.0.0.1`.
4. Dans « Which API/SDKs are you planning to use », coche **Web Playback SDK**.

### Compte Premium

La lecture audio passe par le **Web Playback SDK**, qui nécessite un compte
**Spotify Premium**. Un seul suffit : celui de l'hôte qui lance la partie sur son écran.
(La recherche, elle, ne nécessite pas Premium.)

---

## 🧱 Architecture (MVC)

Séparation nette **backend** (Node/Express) et **frontend** (client-MVC en JS modules,
sans build).

```
blindtest-paroles/
├── server.js                     # démarrage
├── src/                          # BACKEND
│   ├── app.js                    # création de l'app Express (testable)
│   ├── config/index.js           # config centralisée (.env)
│   ├── models/
│   │   ├── SpotifyModel.js        # M — recherche Spotify (client credentials)
│   │   └── LyricsModel.js         # M — paroles LRCLIB (get + fallback search)
│   ├── controllers/
│   │   ├── searchController.js    # C — orchestre Spotify + LRCLIB EN PARALLÈLE
│   │   └── configController.js    # C — expose la config publique (PKCE)
│   ├── routes/index.js            # routes /api
│   ├── services/lrcParser.js      # parsing LRC (pur, testé)
│   └── utils/matchTrack.js        # rapprochement par durée
├── public/                        # FRONTEND (les "View" servies telles quelles)
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── main.js                # bootstrap
│       ├── model/GameModel.js     # M — état & règles du jeu (pur, testé)
│       ├── view/                  # V — SearchView, KaraokeView, StatusView
│       ├── controller/
│       │   ├── GameController.js   # C — boucle de synchro, coupure, verdict
│       │   └── players/            # abstraction lecteur
│       │       ├── PlayerAdapter.js  # interface commune
│       │       ├── SpotifyPlayer.js  # Web Playback SDK
│       │       └── DemoPlayer.js     # synthé Web Audio (hors-ligne)
│       └── lib/                   # pkce.js (OAuth), demoTrack.js
└── test/                          # tests unitaires + smoke HTTP
```

### Le « en parallèle », concrètement

`searchController` interroge Spotify, puis récupère les paroles LRCLIB pour **tous** les
résultats en même temps (`Promise.all`). Chaque morceau est renvoyé avec un flag
`playable` (= paroles synchronisées disponibles). Le frontend n'affiche donc comme
jouables que les morceaux réellement exploitables — sans aller-retour supplémentaire.

### L'abstraction « lecteur »

`GameController` ne connaît qu'une interface (`PlayerAdapter`). On branche indifféremment
`SpotifyPlayer` (réel) ou `DemoPlayer` (hors-ligne). C'est aussi ce qui permettra
d'ajouter un lecteur **YouTube** plus tard sans toucher à la logique de jeu.

---

## 🧪 Tests

```bash
npm test
```

- `test/core.test.js` — parsing LRC, rapprochement par durée, logique de mise et de
  génération du trou (le trou fait toujours exactement N mots, commence en début de
  ligne, la coupure tombe au bon timestamp).
- `test/smoke.test.js` — câblage HTTP (config sans fuite du secret, statiques, fallback SPA).

---

## ⚠️ Note sur les droits d'auteur

Les paroles proviennent de la communauté LRCLIB et la musique de Spotify. Ce projet est
prévu pour un **usage privé entre amis**. Toute diffusion publique nécessiterait de
vérifier les licences des paroles et des flux audio.

---

## 🗺️ Pistes d'évolution

- Lecteur **YouTube** en repli (sans compte, via l'IFrame API).
- Mode **saisie clavier** (la logique de comparaison existe déjà : `checkTypedAnswer`).
- **Multijoueur** en ligne (score, tour par tour) et gestion des joueurs.
- Choix de la **difficulté de zone** (couplet vs refrain).
