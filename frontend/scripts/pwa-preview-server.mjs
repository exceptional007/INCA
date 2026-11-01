// Loopback-only production-build preview with synthetic APIs. Never loads .env.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { interactionResponse, resetInteractions } from './interaction-fixtures.mjs';
const root = fileURLToPath(new URL('../dist/', import.meta.url)).replace(/[\\/]$/, '');
let disconnected = false;
let role = 'FACULTY';
const user = () => ({ id: 'layout-demo', email: 'layout.preview@bit.ac.in', role: { code: role, name: role }, mustChangePassword: false });
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:5188');
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/__controls') {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<h1>Local PWA test controls</h1><p>All records are synthetic.</p><button onclick="fetch('/__mode?disconnected=1').then(()=>document.getElementById('state').textContent='API disconnected')">Disconnect synthetic API</button><button onclick="fetch('/__mode?disconnected=0').then(()=>document.getElementById('state').textContent='API connected')">Reconnect synthetic API</button><p id="state">${disconnected ? 'API disconnected' : 'API connected'}</p><a href="/attendance/mark">Attendance</a>`); return;
    }
    if (url.pathname === '/__mode') { disconnected = url.searchParams.get('disconnected') === '1'; res.end('OK'); return; }
    if (url.pathname === '/__fixture') {
      resetInteractions(); disconnected = false; role = url.searchParams.get('role') || 'FACULTY';
      res.setHeader('Content-Type', 'text/html');
      res.end(`<script>localStorage.setItem('inca_user',${JSON.stringify(JSON.stringify(user()))});localStorage.setItem('inca_token','synthetic-token');location.replace('/hub');</script>`); return;
    }
    if (url.pathname.startsWith('/api/v1/')) {
      res.setHeader('Content-Type', 'application/json');
      if (disconnected) { res.statusCode = 503; res.end(JSON.stringify({ message: 'Synthetic API disconnected' })); return; }
      const route = url.pathname.slice('/api/v1'.length);
      const send = data => res.end(JSON.stringify(data));
      if (route === '/auth/me') { send({ success: true, data: { ...user(), role } }); return; }
      if (route === '/profile/photo') { res.setHeader('Content-Type', 'image/png'); res.end(await readFile(path.join(root, 'icons/inca-192.png'))); return; }
      if (await interactionResponse(req, res, route, send, role)) return;
      send({ success: true, data: [] }); return;
    }
    const candidate = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!candidate.startsWith(root + path.sep) && candidate !== root) { res.statusCode = 400; res.end('Invalid path'); return; }
    let file = candidate;
    let body;
    try { body = await readFile(file); }
    catch { file = path.join(root, 'index.html'); body = await readFile(file); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(body);
  } catch (error) { res.statusCode = 500; res.end(String(error)); }
}).listen(5188, '127.0.0.1', () => console.log('Synthetic PWA preview http://127.0.0.1:5188/__fixture'));
