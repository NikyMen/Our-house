// Carga datos de ejemplo en la base de desarrollo, a través de la API de la app.
// Requiere que estén corriendo: (1) el server de esta carpeta (`npm start`) y
// (2) la app (`pnpm dev`). Por defecto apunta al puerto 4321.
//
//   node seed.mjs                  → usa http://127.0.0.1:4321
//   BASE=http://127.0.0.1:4523 node seed.mjs
//
// Crea dos usuarios (nico / eli, contraseña "prueba123"), una casa y ~6 meses
// de gastos, ingresos y costos fijos para ver los gráficos con datos reales.
const BASE = process.env.BASE ?? 'http://127.0.0.1:4321';

async function api(path, { body, cookie } = {}) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  const setCookie = res.headers.get('set-cookie');
  return { data: text ? JSON.parse(text) : null, cookie: setCookie ? setCookie.split(';')[0] : null };
}

// PRNG determinista para que el seed sea reproducible.
let s = 42;
const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => Math.round((a + rnd() * (b - a)) / 100) * 100;

let nico;
try {
  ({ cookie: nico } = await api('/api/register', {
    body: { username: 'nico', displayName: 'Nico', password: 'prueba123' },
  }));
  console.log('registrado nico');
} catch (err) {
  if (String(err).includes('409') || String(err).toLowerCase().includes('ya exist')) {
    ({ cookie: nico } = await api('/api/login', { body: { username: 'nico', password: 'prueba123' } }));
    console.log('nico ya existía, login ok — ¿seguro que la base está vacía? Abortando para no duplicar.');
    process.exit(0);
  }
  throw err;
}

const { data: houseData } = await api('/api/houses', { body: { name: 'Casa de Nico y Eli' }, cookie: nico });
console.log('casa creada, código', houseData.house.inviteCode);

const { cookie: eli } = await api('/api/register', {
  body: { username: 'eli', displayName: 'Eli', password: 'prueba123' },
});
await api('/api/houses/join', { body: { code: houseData.house.inviteCode }, cookie: eli });
console.log('eli unida');

for (const f of [
  { description: 'Alquiler', amount: 380000, category: 'hogar', paidBy: 'Ambos' },
  { description: 'Internet fibra', amount: 35000, category: 'servicios', paidBy: 'Nico' },
  { description: 'Gimnasio', amount: 42000, category: 'gimnasio', paidBy: 'Eli' },
]) {
  await api('/api/fixed', { body: f, cookie: nico });
}
console.log('fijos creados');

const now = new Date();
const months = [];
for (let i = 5; i >= 0; i--) {
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
  months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
}
const CUR = months[months.length - 1];
const curDay = now.getDate();

const catPool = [
  ['supermercado', 'Compra semanal', 45000, 95000],
  ['verduleria', 'Verdulería', 8000, 22000],
  ['nafta', 'Nafta', 25000, 45000],
  ['kiosko', 'Kiosko', 3000, 12000],
  ['comida', 'Delivery', 15000, 32000],
  ['ocio', 'Salida', 20000, 60000],
  ['farmacia', 'Farmacia', 9000, 28000],
  ['cocacola', 'Coca-Cola', 4000, 9000],
  ['yerba', 'Yerba', 6000, 14000],
  ['servicios', 'Luz y gas', 30000, 55000],
];

let nGastos = 0;
for (const m of months) {
  const isCur = m === CUR;
  const maxDay = isCur ? Math.max(1, curDay) : 28;
  await api('/api/income', {
    body: { description: 'Sueldo Nico', amount: between(880000, 980000), type: 'sueldo', person: 'Nico', date: `${m}-01` },
    cookie: nico,
  });
  await api('/api/income', {
    body: { description: 'Sueldo Eli', amount: between(700000, 800000), type: 'sueldo', person: 'Eli', date: `${m}-03` },
    cookie: nico,
  });
  if (rnd() > 0.55 && !isCur) {
    await api('/api/income', {
      body: { description: 'Trabajo extra', amount: between(60000, 180000), type: 'extra', person: pick(['Nico', 'Eli']), date: `${m}-${String(10 + Math.floor(rnd() * 15)).padStart(2, '0')}` },
      cookie: nico,
    });
  }
  const factor = m === months[months.length - 2] ? 1.45 : 1;
  const count = isCur ? Math.min(7, maxDay) : 9 + Math.floor(rnd() * 4);
  for (let i = 0; i < count; i++) {
    const [category, desc, lo, hi] = pick(catPool);
    const day = 1 + Math.floor(rnd() * maxDay);
    await api('/api/expenses', {
      body: { description: desc, amount: Math.round(between(lo, hi) * factor), category, paidBy: pick(['Nico', 'Eli', 'Ambos']), date: `${m}-${String(day).padStart(2, '0')}` },
      cookie: nico,
    });
    nGastos++;
  }
}
console.log(`listo: ${nGastos} gastos + ingresos + fijos en ${months.length} meses. Entrá con nico / prueba123.`);
