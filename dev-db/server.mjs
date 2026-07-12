// Base PostgreSQL embebida para desarrollo local, sin instalar Postgres ni Docker.
//
// Levanta PGlite (un Postgres que corre dentro de Node) y lo expone por un
// socket TCP en 127.0.0.1:55432, para que la app de Astro se conecte con el
// mismo driver `pg` que usa en producción. Los datos se guardan en ./pgdata.
//
// Uso:
//   cd dev-db && npm install   (solo la primera vez)
//   npm start
// Después, en otra terminal, arrancá la app con `pnpm dev` (usa el .env de la raíz).
//
// Nota: PGlite acepta UNA sola conexión a la vez, por eso el .env de la raíz
// usa PG_POOL_MAX=1. No apunta a esto en producción.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const PORT = 55432;
const db = await PGlite.create('./pgdata');
const server = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1' });
await server.start();
console.log(`PGlite (dev DB) escuchando en 127.0.0.1:${PORT} · datos en ./pgdata`);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
}
