import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Store } from './store.js';
import { createApp } from './app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = process.env.DATABASE_PATH || path.join(root, 'data', 'meeting-room.json');
const app = createApp(new Store(dbPath));
const dist = path.join(root, 'dist');
app.use(express.static(dist));
app.get('*splat', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Meeting Room app listening on http://localhost:${port}`));
