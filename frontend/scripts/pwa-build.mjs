import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
export function incaPwa() {
  let output;
  return {
    name: 'inca-pwa', apply: 'build',
    configResolved(config) { output = path.resolve(config.root, config.build.outDir); },
    async closeBundle() {
      const files = (await readdir(path.join(output, 'assets'))).map(name => `/assets/${name}`);
      const html = await readFile(path.join(output, 'index.html'), 'utf8');
      const version = createHash('sha256').update(html + JSON.stringify(files)).digest('hex').slice(0, 16);
      const precache = ['/index.html', '/manifest.webmanifest', '/icons/inca-192.png', '/icons/inca-512.png', ...files];
      await writeFile(path.join(output, 'sw.js'), `
const CACHE = 'inca-shell-${version}';
const FILES = ${JSON.stringify(precache)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('inca-shell-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => response.ok ? response : caches.match('/index.html', { cacheName: CACHE })).catch(() => caches.match('/index.html', { cacheName: CACHE })));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname, { cacheName: CACHE }).then(cached => cached || fetch(request)));
  }
});
`);
    },
  };
}
