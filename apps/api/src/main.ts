import 'reflect-metadata';
import { createApp } from './bootstrap.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();
const app = await createApp();
await app.listen(env.API_PORT, '0.0.0.0');
console.log(`API http://localhost:${env.API_PORT} · belgeler /docs`);
