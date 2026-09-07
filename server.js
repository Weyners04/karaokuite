import { createApp } from './src/app.js';
import { config, assertSpotifyConfig } from './src/config/index.js';

const app = createApp();

app.listen(config.port, () => {
  const { ok, missing } = assertSpotifyConfig();
  console.log(`\n🎤  Blindtest Paroles — http://127.0.0.1:${config.port}`);
  if (!ok) {
    console.warn(
      `⚠️  Config Spotify incomplète (${missing.join(', ')}).\n` +
        `   La recherche et la lecture ne fonctionneront pas tant que le fichier .env n'est pas rempli.\n` +
        `   → Copie .env.example en .env et renseigne tes identifiants Spotify.\n`,
    );
  }
});
