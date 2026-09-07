import { Router } from 'express';
import { search } from '../controllers/searchController.js';
import { getPublicConfig } from '../controllers/configController.js';

const router = Router();

// Configuration publique (client_id Spotify, redirect_uri) pour le PKCE frontend.
router.get('/config', getPublicConfig);

// Recherche Spotify + paroles LRCLIB en parallèle.
router.get('/search', search);

export default router;
