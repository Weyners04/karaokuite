import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

/**
 * Test de fumée : démarre l'app sur un port éphémère, vérifie le câblage
 * HTTP (config, statiques, SPA fallback, validation), puis referme.
 * N'appelle PAS Spotify/LRCLIB (réseau externe) — on teste l'ossature.
 */
test('câblage HTTP de bout en bout', async (t) => {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  await t.test('GET /api/config renvoie la config publique', async () => {
    const res = await fetch(`${base}/api/config`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok('spotify' in data);
    assert.ok('clientId' in data.spotify);
    assert.ok(!('clientSecret' in data.spotify), 'le secret ne doit jamais fuiter');
    assert.ok('ready' in data);
  });

  await t.test('GET /api/search sans q -> 400', async () => {
    const res = await fetch(`${base}/api/search`);
    assert.equal(res.status, 400);
  });

  await t.test('GET / sert index.html', async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Karaokuite/);
    assert.match(html, /id="stage"/);
  });

  await t.test('les fichiers statiques sont servis', async () => {
    const css = await fetch(`${base}/css/style.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type') || '', /css/);

    const js = await fetch(`${base}/js/main.js`);
    assert.equal(js.status, 200);
    assert.match(js.headers.get('content-type') || '', /javascript/);
  });

  await t.test('/callback (retour OAuth) retombe sur la SPA', async () => {
    const res = await fetch(`${base}/callback?code=abc`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /id="stage"/);
  });

  await new Promise((r) => server.close(r));
});
