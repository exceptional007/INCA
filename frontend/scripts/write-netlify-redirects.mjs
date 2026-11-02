import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function netlifyRedirects(value) {
  let url;
  try { url=new URL(value); } catch { throw new Error('Set VITE_API_URL to the HTTPS Render API URL, ending in /api/v1.'); }
  if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash || !/^\/api\/v1\/?$/.test(url.pathname)) throw new Error('VITE_API_URL must be an HTTPS API URL ending in /api/v1, without credentials or query parameters.');
  const api=url.origin+'/api/v1';
  // Only authentication is proxied: large uploads and Socket.IO go directly to Render.
  // Preserve legacy same-origin public image URLs as well.
  return `/api/v1/auth/* ${api}/auth/:splat 200!\n/api/v1/students/photo/* ${api}/students/photo/:splat 200!\n/* /index.html 200\n`;
}

if(process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  writeFileSync(new URL('../dist/_redirects',import.meta.url),netlifyRedirects(process.env.VITE_API_URL));
  console.log('Netlify auth proxy and SPA fallback generated.');
}
