import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import apiRoutes from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Construit et configure l'application Express (sans la démarrer).
 * Séparer la création du démarrage rend l'app testable.
 */
export function createApp() {
  const app = express();

  // --- API ---
  app.use('/api', apiRoutes);

  // --- Frontend statique ---
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  // La redirection OAuth Spotify (/callback) et toute route "profonde"
  // renvoient l'app (SPA) : le JS lit le ?code= et finalise le PKCE.
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

export default createApp;
