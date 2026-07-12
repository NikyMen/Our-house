# 🏠 OurHouse — Ingresos y gastos del hogar

App sencilla para llevar el control de los ingresos y gastos compartidos del hogar.
Construida con **Astro** (SSR, adaptador Node), **TypeScript**, **PostgreSQL** y **pnpm**.

## Características

- 🔐 Registro e inicio de sesión con **sesiones reales por cookie** (contraseñas
  hasheadas con scrypt en el servidor).
- 🏡 Crear una **casa** e invitar integrantes con un **código de invitación**.
- 🔑 Unirse a una casa existente ingresando el código, **desde cualquier dispositivo**.
- 👥 Cada integrante carga sus propios ingresos y gastos.
- ➕ Gastos con descripción, importe, categoría, fecha y quién pagó.
- 💰 Ingresos (sueldo / extra) por persona.
- 🔁 Costos fijos que se aplican todos los meses.
- 📅 Filtro por mes con selector automático.
- 📊 Resumen del mes: saldo, desglose por categoría y por persona.
- 🗑️ Eliminar movimientos.
- 💲 Importes en pesos argentinos (ARS).
- 🗄️ Persistencia en **PostgreSQL** — los datos se comparten entre dispositivos.
- 🌙 Interfaz oscura, responsive y en español.

## Arquitectura

Es una app **con servidor** (SSR). El proceso Node atiende las páginas y una API
(`/api/*`), y guarda todo en PostgreSQL. Un middleware (`src/middleware.ts`)
resuelve la sesión desde la cookie en cada petición; las páginas protegidas
(`/casa`, `/app`) redirigen del lado del servidor si no hay sesión.

```
src/
├─ middleware.ts        # Resuelve la sesión (cookie) en cada petición
├─ layouts/Layout.astro # HTML base + estilos globales
├─ lib/
│  ├─ types.ts          # Modelo de datos (compartido cliente/servidor)
│  ├─ format.ts         # Formato de moneda y fechas (puro)
│  ├─ calc.ts           # Totales y filtros (puro, cliente/servidor)
│  ├─ db.ts             # ⚙️ SOLO SERVIDOR: PostgreSQL, hashing, sesiones, CRUD
│  ├─ session.ts        # Nombre y opciones de la cookie de sesión
│  ├─ http.ts           # Helpers de los endpoints
│  └─ api-client.ts     # Cliente fetch para los <script> del navegador
└─ pages/
   ├─ index.astro       # Login / registro
   ├─ casa.astro        # Crear casa, unirse con código, elegir casa
   ├─ app.astro         # UI de ingresos/gastos de la casa activa
   └─ api/              # Endpoints (register, login, logout, expenses, …)
```

Las tablas se crean solas la primera vez que la app usa la base (ver
`ensureSchema()` en [`src/lib/db.ts`](src/lib/db.ts)); no hace falta correr
migraciones a mano.

## Requisitos

- [Node.js](https://nodejs.org/) 20.6+ / 22+ (usa `--env-file`)
- [pnpm](https://pnpm.io/) 9+
- [PostgreSQL](https://www.postgresql.org/) 13+

## Desarrollo local

Necesitás una base PostgreSQL. Tenés dos opciones:

**Opción A — con tu propio PostgreSQL:**

```bash
pnpm install
cp .env.example .env          # y completá DATABASE_URL con tu Postgres local
pnpm dev                      # http://localhost:4321
```

**Opción B — base embebida, sin instalar nada (recomendada para probar):**

La carpeta [`dev-db/`](dev-db/) trae un PostgreSQL embebido (PGlite) que corre
dentro de Node, sin instalar Postgres ni Docker.

```bash
pnpm install
# En una terminal, levantá la base de desarrollo:
cd dev-db && npm install && npm start      # PGlite en 127.0.0.1:55432
# (opcional, otra vez en dev-db) cargá datos de ejemplo con la app ya corriendo:
#   npm run seed                            # crea nico / prueba123 + 6 meses de datos
```

Poné en el `.env` de la raíz:

```
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/postgres
PG_POOL_MAX=1
```

y en otra terminal:

```bash
pnpm dev                      # http://localhost:4321
```

> `PG_POOL_MAX=1` es necesario solo con PGlite (acepta una sola conexión). Con
> Postgres real podés quitarlo. Los datos de la base embebida se guardan en
> `dev-db/pgdata/` (ignorada por git).
>
> En desarrollo, `astro dev` lee el `.env` vía `import.meta.env`; en producción
> la config sigue llegando por `process.env` (pm2). `src/lib/db.ts` contempla los
> dos casos.

## Comandos

| Comando        | Acción                                               |
| -------------- | ---------------------------------------------------- |
| `pnpm dev`     | Servidor de desarrollo con recarga en caliente.      |
| `pnpm build`   | Comprueba tipos (`astro check`) y compila a `dist/`. |
| `pnpm start`   | Ejecuta la build de producción (`dist/server`).      |
| `pnpm check`   | Solo comprobación de tipos.                          |

## Despliegue en un VPS (nginx + pm2 + PostgreSQL)

Ver los pasos detallados más abajo. En resumen: crear la base y el usuario en
Postgres, poner un `.env` con `DATABASE_URL`, `pnpm install && pnpm build`,
arrancar con pm2 (`ecosystem.config.cjs`) y proxyear con nginx
(`deploy/nginx-ourhouse.conf`).

## Personalización

- **Moneda / idioma**: `LOCALE` y `CURRENCY` en [`src/lib/format.ts`](src/lib/format.ts) (`es-AR` / `ARS`).
- **Categorías**: `CATEGORIES` en [`src/lib/types.ts`](src/lib/types.ts).
