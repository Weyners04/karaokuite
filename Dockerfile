# Karaokuite — image de production (backend Express + frontend statique servi
# par le même serveur, pas d'étape de build nécessaire).

FROM node:20-alpine

WORKDIR /app

# Dépendances d'abord : ce layer ne se réinvalide que si package*.json change,
# donc les rebuilds après une simple modif de code restent rapides.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Code de l'application (le dossier test/ n'est volontairement pas copié,
# inutile à l'exécution — voir .dockerignore).
COPY server.js ./
COPY src ./src
COPY public ./public

ENV PORT=3000
EXPOSE 3000

# L'image node officielle fournit déjà un utilisateur non-root "node".
USER node

CMD ["node", "server.js"]
