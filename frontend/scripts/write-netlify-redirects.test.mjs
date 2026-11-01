import test from 'node:test';
import assert from 'node:assert/strict';
import { netlifyRedirects } from './write-netlify-redirects.mjs';

test('auth proxy precedes SPA fallback and leaves uploads/chat on Render',()=>{
 const text=netlifyRedirects('https://demo-api.onrender.com/api/v1');
 assert.equal(text.split('\n')[0],'/api/v1/auth/* https://demo-api.onrender.com/api/v1/auth/:splat 200!');
 assert.ok(text.indexOf('/api/v1/auth/*')<text.indexOf('/* /index.html 200'));
 assert.ok(!text.includes('/socket.io'));
 assert.ok(!text.includes('/api/*'));
 assert.ok(!text.includes('/notices/'));
});
test('accepts one trailing slash and rejects unsafe or missing API configuration',()=>{
 assert.equal(netlifyRedirects('https://demo-api.onrender.com/api/v1/'),netlifyRedirects('https://demo-api.onrender.com/api/v1'));
 for(const value of [undefined,'','http://localhost:3000/api/v1','https://user:password@api.example/api/v1','https://api.example/api/v1?secret=x','https://api.example/api/v1#fragment','https://api.example/wrong','https://api.example/api/v1\n/* https://hostile.example 200']) assert.throws(()=>netlifyRedirects(value));
});
