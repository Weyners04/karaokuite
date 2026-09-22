# 🎤 Karaokuite

Jeu de **karaoké à trous entre amis**, façon _N'oublie pas les paroles_ version soirée.
On choisit un morceau, on mise des gorgées, la musique défile avec les paroles
synchronisées… puis **le son se coupe à un moment aléatoire** et il faut retrouver
les mots masqués.

- **Soirée à plusieurs** : participants, tours de passage, jeu **en solo ou en équipes**
- **3 façons de choisir la musique** : recherche libre, choix multiple, tirage aléatoire
- **Recherche Spotify** (métadonnées : titre, artiste, durée, pochette)
- **Paroles synchronisées LRCLIB** récupérées **en parallèle** de la recherche
- **Lecteur synchronisé** qui coupe la musique à un timestamp aléatoire et masque les mots
- **Mode démo** intégré : teste tout le mécanisme **sans compte Spotify**

---

## 🎲 Règle du jeu

### Préparer la soirée

1. **Participants** : on inscrit les joueurs (l'ordre d'inscription = l'ordre de passage).
2. **Paramètres** :
   - **Source audio** : se connecter à Spotify, ou essayer le mode démo.
   - **Choix de la musique** :

     | Mode | Principe |
     |------|----------|
     | Sélection libre | Le joueur cherche et choisit lui-même son morceau. |
     | Choix multiple | Le joueur tape un artiste ou un genre (« Angèle », « rap français »…), le jeu propose **3 morceaux** jouables. Le filtre se ressaisit à chaque tour. |
     | Complètement aléatoire | Aucun choix : le jeu tire un artiste ou un genre (liste surtout francophone) puis un morceau au hasard. Changer de chanson coûte **1 gorgée**. |

   - **Joueurs** : **seul** (chacun son tour) ou **en équipe** (au moins 2 équipes, chaque
     participant assigné, aucune équipe vide). En équipe, ce sont les équipes qui tournent.
3. **Commencer la soirée**. On peut revenir aux paramètres en cours de route sans perdre
   l'ordre de passage.

### Un tour

Avant de lancer, le joueur mise selon sa confiance dans le morceau. **Plus la mise est
haute, plus il y a de mots à retrouver** :

| Mise | Mots à trouver |
|------|----------------|
| 1 gorgée | 3 à 4 mots |
| 3 gorgées | 5 à 6 mots |
| 5 gorgées | 7 à 8 mots |

Le nombre exact dépend de la ligne tirée : le trou est toujours pris **dans une seule
ligne, depuis son début**, pour qu'il y ait une vraie phrase à deviner. Il tombe entre
15 % et 85 % du morceau (ni l'intro, ni la fin).

La musique démarre, les paroles défilent. À un instant aléatoire, **le son se coupe**
et une rangée de mots masqués apparaît. Le joueur dit les mots à voix haute, on
**révèle** la réponse, et le groupe tranche :

- **Trouvé** → le joueur distribue ses gorgées aux autres.
- **Raté** → le joueur boit ses gorgées.

Plus tu mises, plus le trou est large : risque / récompense.

**Indice « initiales »** (une fois par trou, avant la révélation) : affiche la première
lettre de chaque mot masqué. Mais trouver ne rapporte plus que **la moitié** de la mise
(arrondie au-dessus), et rater coûte **le double**.

Après la révélation, **« Continuer la chanson »** relance la musique là où elle s'était
arrêtée. **« Nouvelle chanson »** passe au joueur (ou à l'équipe) suivant.

---

## 🚀 Démarrage rapide

```bash
npm install
cp .env.example .env      # puis remplis tes identifiants Spotify
npm start                 # http://127.0.0.1:3000
```

Sans configuration Spotify, tu peux quand même cliquer sur **« Essayer le mode démo »**
(dans l'écran Paramètres, après avoir ajouté au moins un participant) pour voir tout le
mécanisme fonctionner : chanson de test synthétisée, paroles originales. En mode démo,
il n'y a qu'une chanson : le mode de choix de la musique est ignoré.

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
│       ├── model/
│       │   ├── GameModel.js        # M — un tour : morceau, mise, trou, verdict (pur, testé)
│       │   └── PartyModel.js       # M — la soirée : participants, modes, équipes, tours (pur, testé)
│       ├── view/                  # V — une vue par écran : Participants, Settings,
│       │                          #     TurnBanner, Search, TrackPicker, Karaoke, Status…
│       ├── controller/
│       │   ├── GameController.js   # C — compose les 2 modèles, synchro, coupure, verdict
│       │   └── players/            # abstraction lecteur
│       │       ├── PlayerAdapter.js  # interface commune
│       │       ├── SpotifyPlayer.js  # Web Playback SDK
│       │       └── DemoPlayer.js     # synthé Web Audio (hors-ligne)
│       └── lib/
│           ├── pkce.js             # OAuth Spotify (PKCE)
│           ├── demoTrack.js        # chanson du mode démo
│           ├── randomSeeds.js      # artistes/genres pour le mode Aléatoire
│           └── trackPicking.js     # tirage aléatoire / échantillon de 3 morceaux
└── test/                          # tests unitaires + smoke HTTP
```

### Le « en parallèle », concrètement

`searchController` interroge Spotify, puis récupère les paroles LRCLIB pour **tous** les
résultats en même temps (`Promise.all`). Chaque morceau est renvoyé avec un flag
`playable` (= paroles synchronisées disponibles). Le frontend n'affiche donc comme
jouables que les morceaux réellement exploitables — sans aller-retour supplémentaire.

Les modes Choix multiple et Aléatoire demandent plus de résultats via `?limit=`
(plafonné à 10 : au-delà, l'API Spotify renvoie une erreur 400 en mode Development).

### Deux modèles, un contrôleur

`GameModel` ne connaît qu'un tour (morceau, mise, trou, verdict) ; `PartyModel` ne
connaît que la soirée (participants, paramètres, équipes, ordre de passage).
`GameController` compose les deux : ni l'un ni l'autre ne touche au DOM, ce qui les
rend testables directement.

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
  génération du trou (le nombre de mots reste dans la tranche de la mise, le trou tient
  dans une seule ligne et commence à son début), indice « initiales » et verdict.
- `test/party.test.js` — participants, équipes et assignations, conditions de démarrage,
  rotation des tours (solo et équipe), tirage aléatoire des morceaux.
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
- **Multijoueur en ligne** (chacun sur son téléphone) — aujourd'hui tout se joue sur
  l'écran de l'hôte.
- **Tableau des scores** : compter les gorgées bues et distribuées par joueur ou équipe.
- Choix de la **difficulté de zone** (couplet vs refrain).
