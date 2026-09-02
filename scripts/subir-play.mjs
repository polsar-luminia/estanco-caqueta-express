#!/usr/bin/env node
/**
 * Sube un .aab a Google Play SIN pasar por los servidores de EAS.
 *
 * POR QUE EXISTE: `eas submit` funciona, pero manda el artefacto a EAS para que
 * ellos lo suban. Esto habla directo con la Play Developer API usando
 * `play-service-account.json`, que ya vive en el repo (y esta en .gitignore).
 * Todo el trayecto es local salvo la llamada a Google, que es el destino.
 *
 * Uso:
 *   node scripts/subir-play.mjs --aab /ruta/app.aab [--track production] [--borrador]
 *
 * `--borrador` sube el .aab y crea la release en estado `draft`: queda en Play
 * Console para revisarla y publicarla a mano. SIN esa bandera sale a
 * produccion al 100% de inmediato — y eso NO se puede deshacer: Play no permite
 * detener un rollout que ya esta completo (comprobado el 31-ago-2026, tres
 * intentos, tres 500). Por eso el default es borrador.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i+1] ? process.argv[i+1] : d; };
const tiene = (n) => process.argv.includes(`--${n}`);

const AAB = arg('aab');
const TRACK = arg('track', 'production');
const BORRADOR = !tiene('publicar');       // publicar de verdad exige decirlo
const PKG = 'co.estancocaqueta.express';
const SA = JSON.parse(readFileSync(path.join(process.cwd(), 'play-service-account.json'), 'utf8'));

if (!AAB) { console.error('Falta --aab <ruta>'); process.exit(1); }

const b64 = (b) => Buffer.from(b).toString('base64url');
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64(JSON.stringify({
    iss: SA.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const si = `${head}.${claim}`;
  const sig = crypto.createSign('RSA-SHA256').update(si).sign(SA.private_key).toString('base64url');
  return `${si}.${sig}`;
}

async function token() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt() }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('no hubo token: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
let TOK;
async function api(p, { method = 'GET', body, raw, upload } = {}) {
  const url = (upload ? `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PKG}` : BASE) + p;
  const h = { Authorization: `Bearer ${TOK}` };
  if (raw) h['Content-Type'] = 'application/octet-stream';
  else if (body) h['Content-Type'] = 'application/json';
  const r = await fetch(url, { method, headers: h, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status}\n${t.slice(0, 500)}`);
  return t ? JSON.parse(t) : {};
}

TOK = await token();
const aab = readFileSync(AAB);
console.log(`aab: ${AAB} (${(aab.length / 1e6).toFixed(1)} MB)`);

const edit = await api('/edits', { method: 'POST' });
console.log('edit:', edit.id);

const subido = await api(`/edits/${edit.id}/bundles?uploadType=media`, { method: 'POST', raw: aab, upload: true });
console.log('subido: versionCode', subido.versionCode);

const release = {
  name: `${subido.versionCode}`,
  versionCodes: [String(subido.versionCode)],
  status: BORRADOR ? 'draft' : 'completed',
};
await api(`/edits/${edit.id}/tracks/${TRACK}`, { method: 'PUT', body: { track: TRACK, releases: [release] } });
console.log(`release en track "${TRACK}" con status "${release.status}"`);

await api(`/edits/${edit.id}:commit`, { method: 'POST' });
console.log('COMMIT OK');
console.log(BORRADOR
  ? '\nQuedo como BORRADOR. Revisalo en Play Console y publicalo a mano.\n(Para salir directo al 100%: --publicar. Ojo: eso no se puede deshacer.)'
  : '\nPUBLICADO al 100%. Play no permite detener un rollout completo.');
