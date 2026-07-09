// Configuración de pm2 para OurHouse.
// Arranca el servidor Astro (adaptador Node) y carga las variables desde .env
// usando el flag nativo de Node 20.6+/22 (--env-file).
//
//   pm2 start ecosystem.config.cjs
//   pm2 save
//
module.exports = {
  apps: [
    {
      name: 'ourhouse',
      script: './dist/server/entry.mjs',
      // IMPORTANTE: modo fork. El modo cluster de pm2 carga la app con
      // require() y no soporta módulos ESM (.mjs) como el entry de Astro.
      exec_mode: 'fork',
      node_args: '--env-file=.env',
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
