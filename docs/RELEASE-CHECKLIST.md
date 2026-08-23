# Checklist de release — app de clientes

- [ ] `git status` revisado; commit/tag reproducible.
- [ ] Tests, typecheck, lint y `npm run docs:check` pasan.
- [ ] Cambio clasificado como OTA o nativo.
- [ ] Últimos números consultados en EAS y tiendas.
- [ ] Build EAS `finished` en cada plataforma antes de hablar de submit.
- [ ] Submit, revisión y publicación verificados por plataforma.
- [ ] OTA probado en binario real del mismo runtime.
- [ ] Compatibilidad de binarios viejos y `X-App-Version` validada.
- [ ] `docs/CHANGELOG.md` y `docs/RELEASE-ESTADO.md` actualizados.
- [ ] Snapshot central regenerado; cero secretos en diff/log.

