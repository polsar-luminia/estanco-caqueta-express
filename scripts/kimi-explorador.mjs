#!/usr/bin/env node
/**
 * Explorador de la app guiado por Kimi (Moonshot), encarnando a una persona.
 *
 * QUE ES Y QUE NO ES. No sustituye a Maestro: Maestro afirma un recorrido
 * conocido y falla cuando cambia, que es lo que hace falta para no romper lo
 * que ya funciona. Esto es lo contrario — no sabe adonde va, y por eso sirve
 * para lo que un recorrido escrito NUNCA encuentra: lo que hace una persona que
 * no entiende la pantalla. Cada corrida es distinta; un hallazgo hay que
 * reproducirlo a mano antes de creerselo.
 *
 * COMO FUNCIONA: captura la pantalla con adb, se la manda a kimi-k3 (que tiene
 * vision) junto con la persona y el objetivo, y ejecuta la accion que devuelve.
 * Repite. Al final escribe un informe con lo que el modelo marco como raro.
 *
 * SEGURIDAD — solo contra el backend de pruebas:
 *   Comprueba que 127.0.0.1:3999 responde ANTES de tocar nada, y aborta si no.
 *   Ese servidor corre sobre un Postgres embebido, aislado de produccion. Si un
 *   dia esta apagado y la app apunta a otro sitio, el explorador no arranca: es
 *   la misma leccion de MAESTRO_ENV, que protege contra "olvide la variable"
 *   pero no contra "la app no mira aca".
 *
 * Uso:
 *   node scripts/kimi-explorador.mjs --persona miriam --pasos 20
 *   node scripts/kimi-explorador.mjs --lista
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const ADB = process.env.ADB || `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`;
const PAQUETE = 'co.estancocaqueta.express';
const BACKEND_PRUEBAS = 'http://127.0.0.1:3999/api/v1/health';
const API = 'https://api.moonshot.ai/v1/chat/completions';
const MODELO = process.env.KIMI_MODELO || 'kimi-k3';
const SALIDA = path.join(process.cwd(), 'scripts', 'kimi-logs');

// Las personas. Cada una es una forma distinta de romper la app, no un adorno:
// lo que se busca es el fallo que solo aparece cuando alguien NO hace lo obvio.
const PERSONAS = {
  miriam: {
    nombre: 'Doña Miriam, 58 años',
    como: `Tienes prisa y el dedo grueso. Tocas dos veces cada boton porque no estas
segura de si registro. Escribes el telefono como lo tienes en la agenda: con
espacios y a veces con +57. A veces te equivocas de campo. Si algo sale mal, no
lees el mensaje: vuelves a intentar lo mismo.`,
    objetivo: 'Entrar a tu cuenta para pedir algo.',
  },
  kevin: {
    nombre: 'Kevin, 24 años',
    como: `Reinstalaste la app y no te acuerdas de la contraseña, pero estas seguro de
tu numero. Insistes una y otra vez. Despues de 3 o 4 intentos decides que no
tenias cuenta y te vas a registrarte con el mismo numero. Solo al final pruebas
"¿Olvidaste tu contraseña?".`,
    objetivo: 'Entrar como sea.',
  },
  yeimy: {
    nombre: 'Yeimy, 31 años',
    como: `Es tu primera vez. Metes cosas al carrito sin cuenta y solo entonces te topas
con que hay que registrarse. Rellenas el formulario a medias para ver que pasa.
Pones contraseñas cortas primero. Te equivocas en la fecha de nacimiento. Tocas
el ojito de la contraseña ANTES de escribirla.`,
    objetivo: 'Comprar algo, creando la cuenta por el camino.',
  },
};

function arg(nombre, pordefecto) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : pordefecto;
}
const sh = (args, opts = {}) => execFileSync(ADB, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });

if (process.argv.includes('--lista')) {
  for (const [k, p] of Object.entries(PERSONAS)) console.log(`  ${k.padEnd(8)} ${p.nombre}`);
  process.exit(0);
}

const CLAVE = process.env.MOONSHOT_API_KEY;
if (!CLAVE) {
  console.error('Falta MOONSHOT_API_KEY. Guardala en ~/.zshrc y `source ~/.zshrc`.');
  process.exit(1);
}

const personaId = arg('persona', 'miriam');
const persona = PERSONAS[personaId];
if (!persona) {
  console.error(`Persona desconocida: ${personaId}. Opciones: ${Object.keys(PERSONAS).join(', ')}`);
  process.exit(1);
}
const MAX_PASOS = Number(arg('pasos', 20));

// --- Guardarrail: solo contra el backend de pruebas -----------------------
try {
  const r = await fetch(BACKEND_PRUEBAS, { signal: AbortSignal.timeout(4000) });
  const j = await r.json();
  if (!j.ok) throw new Error('respuesta inesperada');
} catch (e) {
  console.error(`ABORTADO: el backend de pruebas no responde en ${BACKEND_PRUEBAS} (${e.message}).`);
  console.error('Este explorador escribe datos (crea cuentas, pedidos). Sin el 3999 vivo no se');
  console.error('puede garantizar contra que backend esta hablando la app, asi que no arranca.');
  console.error('  Levantalo: cd "../Polo & Salazar/Polo Dashboard" && npm run servidor:pruebas --workspace=packages/api');
  process.exit(1);
}

mkdirSync(SALIDA, { recursive: true });
const marca = arg('marca', String(Date.now()));
const dir = path.join(SALIDA, `${personaId}-${marca}`);
mkdirSync(dir, { recursive: true });

function captura(paso) {
  const png = path.join(dir, `paso-${String(paso).padStart(2, '0')}.png`);
  // -p por stdout en binario: `exec-out` no traduce saltos de linea como `shell`.
  writeFileSync(png, execFileSync(ADB, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 }));
  return png;
}

const HERRAMIENTAS = `
Acciones disponibles (devuelve UNA por turno, en JSON):
  {"accion":"tocar","x":540,"y":1200,"por_que":"..."}
  {"accion":"escribir","texto":"3001234567","por_que":"..."}
  {"accion":"borrar","veces":10,"por_que":"..."}
  {"accion":"atras","por_que":"..."}
  {"accion":"esperar","segundos":3,"por_que":"..."}
  {"accion":"terminar","por_que":"..."}

Coordenadas en una pantalla de 1080x2400 (x de 0 a 1080, y de 0 a 2400).
IMPORTANTE: si el teclado esta abierto, la pantalla se desplaza — fijate en la
captura ACTUAL, no en donde estaba el boton antes.
`;

const SISTEMA = `Eres ${persona.nombre} usando una app colombiana de domicilios de licores.
${persona.como}

Tu objetivo: ${persona.objetivo}

NO eres un probador experto: actua como esa persona, con sus errores. Pero ADEMAS,
en cada paso, anota si ves algo MAL desde el punto de vista de quien la usa:
- un mensaje de error que no explica nada o que señala al campo equivocado
- una pantalla de la que no se puede salir ni avanzar
- un boton que no responde
- texto cortado, encima de otro, o en ingles
- cualquier cosa que te dejaria atascada

${HERRAMIENTAS}

Responde SIEMPRE con un unico objeto JSON, sin texto alrededor, con esta forma:
{"observacion":"que ves en la pantalla, en una frase",
 "problema":null o "descripcion del problema si algo esta mal",
 "accion":"tocar|escribir|borrar|atras|esperar|terminar", ...campos de la accion}`;

// Ritmo. La cuenta tiene un tope de organizacion de 3 peticiones por minuto
// (el 429 lo dice literal: "organization max RPM: 3"), asi que una llamada cada
// ~21 s es lo maximo sostenible. Sin esto el explorador muere en el paso 6.
const MS_ENTRE_LLAMADAS = Number(process.env.KIMI_MS_ENTRE_LLAMADAS || 21000);
let ultimaLlamada = 0;

async function preguntar(mensajes, reintento = 0) {
  const espera = MS_ENTRE_LLAMADAS - (Date.now() - ultimaLlamada);
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaLlamada = Date.now();
  const r = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLAVE}`, 'Content-Type': 'application/json' },
    // max_tokens generoso a proposito: con poco presupuesto k3 gasta todo en
    // `reasoning_content` y devuelve `content` VACIO — parece que no respondio
    // cuando en realidad si vio la imagen.
    // Sin `temperature`: kimi-k3 solo acepta 1 y rechaza cualquier otro valor
    // con un 400 ("invalid temperature: only 1 is allowed for this model").
    body: JSON.stringify({ model: MODELO, max_tokens: 1200, messages: mensajes }),
    signal: AbortSignal.timeout(120000),
  });
  const j = await r.json();
  // El 429 es de ritmo, no de cuota: se reintenta con espera creciente en vez de
  // abortar la corrida entera y perder el contexto acumulado.
  if (r.status === 429 && reintento < 4) {
    const s = 25 * (reintento + 1);
    console.log(`      (tope de ritmo; espero ${s}s y reintento)`);
    await new Promise((res) => setTimeout(res, s * 1000));
    return preguntar(mensajes, reintento + 1);
  }
  if (!r.ok) throw new Error(`Kimi ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const m = j.choices?.[0]?.message ?? {};
  return (m.content && m.content.trim()) || m.reasoning_content || '';
}

function extraerJson(txt) {
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

console.log(`Explorador Kimi — ${persona.nombre} (${MODELO}), ${MAX_PASOS} pasos`);
console.log(`Salida: ${dir}\n`);

// Tuneles de adb ANTES de arrancar. Sin ellos el dev client no encuentra Metro
// y pinta la pantalla roja "Unable to load script": el explorador la reporta
// como un fallo gravisimo de la app —lo parece— cuando es del entorno. Ya paso
// en la primera corrida, y es la razon de que el arnes se compruebe solo.
for (const puerto of ['8081', '3999']) {
  try { sh(['reverse', `tcp:${puerto}`, `tcp:${puerto}`]); } catch { /* sin emulador; el guard de abajo avisa */ }
}

sh(['shell', 'am', 'force-stop', PAQUETE]);
sh(['shell', 'am', 'start', '-n', `${PAQUETE}/.MainActivity`]);
await new Promise((r) => setTimeout(r, 14000));

const bitacora = [];
const historial = [{ role: 'system', content: SISTEMA }];

for (let paso = 1; paso <= MAX_PASOS; paso++) {
  const png = captura(paso);
  const b64 = readFileSync(png).toString('base64');

  historial.push({
    role: 'user',
    content: [
      { type: 'text', text: `Paso ${paso}. Esta es la pantalla ahora. ¿Que haces?` },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
    ],
  });

  let bruto;
  try { bruto = await preguntar(historial); }
  catch (e) { console.error(`  paso ${paso}: fallo la llamada a Kimi — ${e.message}`); break; }

  const d = extraerJson(bruto);
  if (!d?.accion) { console.error(`  paso ${paso}: respuesta sin accion util; corto aqui.`); break; }

  // Solo se guarda el texto en el historial: reenviar todas las imagenes hace
  // crecer el contexto sin limite y encarece cada turno.
  historial[historial.length - 1] = { role: 'user', content: `Paso ${paso}: [captura]` };
  historial.push({ role: 'assistant', content: JSON.stringify(d) });

  const linea = { paso, png: path.basename(png), ...d };
  bitacora.push(linea);
  console.log(`  ${String(paso).padStart(2)}. ${d.accion.padEnd(8)} ${d.observacion || ''}`);
  if (d.problema) console.log(`      ⚠ ${d.problema}`);

  if (d.accion === 'terminar') break;
  try {
    if (d.accion === 'tocar') sh(['shell', 'input', 'tap', String(Math.round(d.x)), String(Math.round(d.y))]);
    else if (d.accion === 'escribir') sh(['shell', 'input', 'text', String(d.texto).replace(/ /g, '%s')]);
    else if (d.accion === 'borrar') for (let i = 0; i < (d.veces || 10); i++) sh(['shell', 'input', 'keyevent', '67']);
    else if (d.accion === 'atras') sh(['shell', 'input', 'keyevent', '4']);
    else if (d.accion === 'esperar') await new Promise((r) => setTimeout(r, (d.segundos || 2) * 1000));
  } catch (e) { console.error(`      no se pudo ejecutar: ${e.message}`); }
  await new Promise((r) => setTimeout(r, 2500));
}

const problemas = bitacora.filter((b) => b.problema);
writeFileSync(path.join(dir, 'bitacora.json'), JSON.stringify({ persona: personaId, modelo: MODELO, pasos: bitacora }, null, 2));
console.log(`\n${bitacora.length} pasos · ${problemas.length} problemas señalados`);
for (const p of problemas) console.log(`  paso ${p.paso} (${p.png}): ${p.problema}`);
console.log(`\nInforme: ${dir}/bitacora.json`);
console.log('OJO: cada corrida es distinta y el modelo se equivoca. Reproduce a mano antes de abrir un bug.');
