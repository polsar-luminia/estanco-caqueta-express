#!/usr/bin/env node
import fs from 'node:fs';
const app = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url))).expo;
const estado = fs.readFileSync(new URL('../docs/RELEASE-ESTADO.md', import.meta.url), 'utf8');
const errors = [];
for (const value of [app.version, String(app.ios.buildNumber), String(app.android.versionCode)]) {
  if (!estado.includes(`\`${value}\``)) errors.push(`RELEASE-ESTADO no registra ${value}`);
}
if (!estado.includes('NO VERIFICADO')) errors.push('el estado debe admitir fuentes externas no verificadas');
if (/BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|(?:TOKEN|PASSWORD|SECRET)=\S+/i.test(estado)) errors.push('posible secreto en RELEASE-ESTADO');
if (errors.length) { console.error(errors.map((e) => `ERROR: ${e}`).join('\n')); process.exit(1); }
console.log(`OK docs release clientes: ${app.version}/${app.ios.buildNumber}/${app.android.versionCode}`);
