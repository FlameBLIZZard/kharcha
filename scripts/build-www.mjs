// Copies the web app into www/ so Capacitor can wrap it as an Android app.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
rmSync('www', { recursive: true, force: true });
mkdirSync('www', { recursive: true });
for (const f of ['index.html', 'parse.js', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) cpSync(f, 'www/' + f);
cpSync('fonts', 'www/fonts', { recursive: true });
console.log('www/ ready');
