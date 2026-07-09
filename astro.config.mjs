// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// App con servidor (SSR) + adaptador Node. Se ejecuta como proceso propio
// (por ejemplo con pm2) detrás de nginx. Los datos viven en PostgreSQL.
// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: '127.0.0.1', port: 4321 },
});
