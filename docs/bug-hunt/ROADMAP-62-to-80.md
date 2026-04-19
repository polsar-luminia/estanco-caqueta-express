# Roadmap: de 62 a 80 — Estanco Caquetá Express

## Objetivo

Subir la app de **62/100 (alpha con verificadores)** a **80/100 (abrir al público)** en 3 fases secuenciales. Cada fase tiene entregables medibles y verificación end-to-end.

Total estimado: **~6 días hábiles** (A: 1 día, B: 2-3 días, C: 2-3 días). A se puede hacer en paralelo con B.

Estado de infraestructura actual:
- ✅ Vitest + supertest ya configurados en `packages/api/` con 2 archivos de test (340 líneas en `clientes.test.js` + `pedidos.test.js`).
- ✅ Mobile tiene vitest instalado pero sin test files aún.
- ⚠️ Existe `.github/workflows/deploy.yml` en polo-dashboard pero dispara en push a `main` (la rama activa es `master`) — nunca se ha ejecutado.
- ❌ No hay mobile CI. No hay staging. No hay smoke tests automáticos.

---

## Fase A — Cerrar 4 P1 de UX (+3 puntos → 65)

**Objetivo:** Los usuarios dejan de tropezar con fricciones visibles. ~4-6 horas.

### A1. `CHECK-003` Validación de stock en carrito
**Problema:** El carrito permite subir cantidad sin límite. Al confirmar, POST /pedidos devuelve "Stock insuficiente" con total ya calculado.
**Fix:** Incluir `stock_total` en la respuesta de `GET /catalogo/productos/:id` (ya existe). En `src/stores/cart.ts` guardar `stockMaximo` junto al item. En `CartItem.tsx`, el botón `+` deshabilitado si `cantidad >= stockMaximo`, mostrar toast "Solo quedan N unidades".

**Archivos:** `src/stores/cart.ts`, `src/components/CartItem.tsx`, `app/product/[id].tsx` (al hacer `addItem`, pasar `stock_total`).

### A2. `AUTH-004` Validación de teléfono alineada cliente/servidor
**Problema:** Cliente valida 10 dígitos exactos, backend acepta 7-15. Usuarios con celular extranjero son rechazados sin mensaje claro.
**Fix:** Elegir una regla única. Recomendación: **mantener 10 dígitos en cliente** (norma Colombia) y **apretar backend a 10** también (`^[0-9]{10}$` en `clientes.js:33`). Mensaje de error consistente.

**Archivos:** `polo-dashboard/packages/api/src/routes/clientes.js:33`, `app/(auth)/register.tsx` (ya valida 10).

### A3. `UIAPI-004` KeyboardAvoidingView con offset en auth/modales
**Problema:** En login/register/forgot-password/verify-otp, el teclado tapa inputs y botones.
**Fix:** Añadir `keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}` a los `KeyboardAvoidingView` de las 4 pantallas de auth + modales (BarrioSelector, DateSelector).

**Archivos:** `app/(auth)/login.tsx`, `register.tsx`, `forgot-password.tsx`, `verify-otp.tsx`, `src/components/BarrioSelector.tsx`, `src/components/DateSelector.tsx`.

### A4. `PROF-003` Proteger eliminación de dirección con pedidos activos
**Problema:** Borrar una dirección que tiene pedidos `recibido/preparando/despachado` deja huérfanos.
**Fix:** En backend, antes de `DELETE FROM direcciones_cliente`, hacer `SELECT COUNT(*) FROM pedidos WHERE direccion_id = $1 AND estado IN ('recibido','preparando','despachado')`. Si >0, devolver `409 Conflict`. En mobile capturar 409 y mostrar toast "No puedes eliminar una dirección con pedidos activos".

**Archivos:** `polo-dashboard/packages/api/src/routes/clientes.js` (endpoint DELETE direcciones), `app/profile/direcciones.tsx`.

### Verificación Fase A
```bash
# Backend unit tests (se añaden en Fase B, aquí solo manuales):
curl -X DELETE .../clientes/direcciones/42  # → 409 si tiene pedidos activos
curl -X POST .../clientes/registrar -d '{"telefono":"12345","nombre":"X","password":"aaaaaaaa"}'
  # → 400 "Teléfono invalido" (10 digitos)
```
**Manual en Expo Go:** login, add al carrito, subir cantidad hasta el límite, ver toast. Login, registrar con teléfono 9 dígitos, ver error. Forgot-password con teclado abierto, ver botón visible.

**Deliverable:** 1 commit backend + 1 commit mobile + OTA. +3 pts.

---

## Fase B — Tests del flujo crítico (+10 puntos → 75)

**Objetivo:** Cada regresión futura falla en CI, no en producción. ~2-3 días.

### B1. Ampliar tests backend (`packages/api/src/routes/__tests__/`)
Ya hay infra. Ampliar cobertura al flujo de pedido end-to-end.

**Archivos nuevos:**
- `pedidos.test.js` (expandir): happy path, stock insuficiente, cupón inválido, cupón expirado, pedido < pedido_minimo, total < 1000 (tras descuento), uso de puntos, race condition doble-submit (dos requests concurrentes con misma `Idempotency-Key` deben producir solo un pedido — ver B1b).
- `catalogo.test.js` (nuevo): `/productos` filtros, `/buscar` ≥2 chars, `/destacados`, `/sugerencias/:id` con id inválido.
- `cupones.test.js` (nuevo): `/validar` cupón porcentaje, cupón fijo, cupón ya usado, cupón agotado, cupón con min_pedido > subtotal.
- `configuracion-app.test.js` (nuevo): GET devuelve envio_* y pedido_minimo. PUT sin auth → 401. PUT con role admin actualiza.
- `tienda.test.js` (nuevo): `/estado` horario abierta, cerrada, OVERRIDE.
- `combos.test.js` (nuevo): `/combos` devuelve solo activos ordenados.

**Target:** **≥80% coverage en `routes/`**. `npm run test -- --coverage` mide.

### B1b. Idempotency key (opcional pero recomendado)
Para testear el doble-submit a nivel API: header `Idempotency-Key` en POST /pedidos. Si llega dos veces el mismo key en ≤60s, la segunda retorna el pedido original. Tabla simple `idempotency_keys(key, pedido_id, created_at)` + middleware.

### B2. Tests mobile (unit + integration)
**Setup:**
```bash
cd C:\tmp\eas-build && npm i -D @testing-library/react-native @testing-library/react-hooks
```

**Archivos nuevos:**
- `src/lib/__tests__/api.test.ts`: apiFetch con mocks de fetch — 401 llama unauthorizedHandler, 404 mensaje específico, 5xx genérico, JSON inválido, timeout.
- `src/stores/__tests__/cart.test.ts`: addItem, incrementa si existe, clear, getTotal. Rehidratación desde AsyncStorage mock.
- `src/stores/__tests__/auth.test.ts`: hydrate con token válido, hydrate sin token, logout limpia state + SecureStore, 401 callback resetea.

### B3. E2E con Maestro (flujo de pedido completo)
**Por qué Maestro:** más simple que Detox, YAML declarativo, corre sobre Expo Go y build nativo.

```bash
# Windows: descargar desde https://maestro.mobile.dev/getting-started/installing-maestro
# Luego:
cd C:\tmp\eas-build && mkdir -p .maestro && touch .maestro/flow-pedido.yaml
```

**Flujo mínimo** (`.maestro/flow-pedido.yaml`):
1. Launch app → login con cuenta test
2. Home → tocar un producto
3. Agregar al carrito
4. Tab carrito → verificar total
5. Seleccionar dirección
6. Tap "Confirmar pedido" → verificar toast "Pedido confirmado"
7. Tap historial → verificar aparece el pedido

Correr: `maestro test .maestro/flow-pedido.yaml`. Tiempo: ~45s.

### B4. CI mínimo en ambos repos
**polo-dashboard** (`.github/workflows/test.yml`):
```yaml
name: Tests
on: [push, pull_request]
jobs:
  api-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: psql -h localhost -U postgres -f packages/shared/src/migrations/*.sql
      - run: npm run -w packages/api test
```

**estanco-caqueta-express** (`.github/workflows/test.yml`):
```yaml
name: Tests
on: [push, pull_request]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run test
      - run: npx tsc --noEmit  # type-check
```

### Verificación Fase B
- `npm run test` en ambos repos: verde, coverage ≥70% global, ≥80% en `routes/` y `src/lib/api.ts`.
- Push a una rama de prueba: GitHub Actions corre los tests y pasa.
- Romper a propósito un endpoint, hacer PR: CI rojo.
- `maestro test .maestro/flow-pedido.yaml`: pasa end-to-end.

**Deliverable:** 2 commits backend (tests + CI workflow), 2 commits mobile (tests + CI), smoke test Maestro documentado. +10 pts.

---

## Fase C — Staging + CI deploy automático (+5 puntos → 80)

**Objetivo:** Ningún cambio toca prod sin haber pasado por staging con tests verdes. ~2-3 días.

### C1. Entorno staging en VPS
Nuevo dominio, nueva DB, nuevo proceso PM2.

**Infra VPS:**
1. DNS: añadir registro A `staging.poloysalazar.luminiatech.digital` → mismo IP.
2. DB: `CREATE DATABASE polo_staging;` + ejecutar todas las migraciones.
3. Copia de datos recientes (opcional, para pruebas realistas):
   ```bash
   pg_dump polo_db --data-only -t productos -t categorias -t barrios \
     | psql polo_staging
   ```
4. `.env.staging` con DB_NAME=polo_staging, JWT_SECRET distinto, puerto 3003.
5. Nginx vhost `staging.poloysalazar.luminiatech.digital` → `proxy_pass http://127.0.0.1:3003`.
6. PM2: `polo-api-staging` en puerto 3003 leyendo `/opt/polo-staging/.env`.
7. `/opt/polo-staging/src/` como checkout git separado del repo, rama `staging`.

**Rama workflow:**
- `master` → producción.
- `staging` → staging environment (auto-deploy).
- Feature branches → PR a staging → deploy auto a staging → smoke tests → si verde, merge PR a master → deploy auto a prod.

### C2. GitHub Actions deploy (reemplaza el actual `deploy.yml`)

**`.github/workflows/deploy-staging.yml`** (trigger: push a `staging`):
```yaml
name: Deploy Staging
on: { push: { branches: [staging] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run -w packages/api test  # fail-closed
      - run: npm run -w packages/web build
      - name: Deploy to staging
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: root
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/polo-staging/src && git pull origin staging
            npm ci --omit=dev
            cp -r packages/web/dist/* /var/www/polo-staging-admin/
            pm2 restart polo-api-staging
      - name: Smoke tests
        run: |
          sleep 5
          curl -f https://staging.poloysalazar.luminiatech.digital/api/v1/health
          curl -f https://staging.poloysalazar.luminiatech.digital/api/v1/tienda/estado
```

**`.github/workflows/deploy-production.yml`** (trigger: push a `master`):
- Copia del anterior pero apunta a `/opt/polo/src`, puerto 3002, dominio prod.
- **Requerimiento manual:** aprobación en GitHub Environment protection (UI) antes de deploy.

### C3. Mobile: Preview builds por PR
`.github/workflows/eas-preview.yml`:
```yaml
name: EAS Preview
on: { pull_request: { branches: [master] } }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx eas-cli update --branch preview-pr-${{ github.event.number }} --message "PR ${{ github.event.number }}"
        env: { EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }} }
      - uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '📱 Preview listo en canal `preview-pr-${{ github.event.number }}`'
            })
```

### Verificación Fase C
1. Hacer cambio en backend, push a `staging` → GitHub Actions corre tests → deploya a VPS → smoke test pasa → dominio staging responde con el cambio.
2. Hacer PR a `master` desde `staging` → aprobar en UI → deploy a prod → verificar en `https://poloysalazar.luminiatech.digital`.
3. Romper test en rama staging → push → CI falla → NO deploya.
4. Mobile: abrir PR → workflow publica canal preview → abrir app con ese canal en Expo Go → ver el cambio.

**Deliverable:**
- Subdominio staging activo con DB propia.
- 2 workflows de deploy (staging, prod) con tests como gate.
- 1 workflow de preview mobile.
- Documentación en `polo-dashboard/README.md` de cómo funciona el flow.

+5 pts.

---

## Ruta crítica y orden recomendado

| Semana | Lunes | Martes | Miércoles | Jueves | Viernes |
|---|---|---|---|---|---|
| 1 | Fase A completa | B1 tests backend | B1 sigue + B2 tests mobile | B3 Maestro + B4 CI | B4 CI + verificación |
| 2 | C1 staging infra | C2 workflows | C3 preview mobile + verificación | Observabilidad (bonus) | Abrir al público |

Fase A y B1 se pueden empezar en paralelo si alguien más ayuda.

## Riesgos

- **Staging DB clone** puede exponer PII de clientes reales. Mitigación: anonimizar teléfonos (`UPDATE clientes SET telefono = '0000000' || id`) antes del clone.
- **CI lento** si tests se acoplan a DB. Mitigación: usar `pg-mem` o base de datos transaccional con rollback por test.
- **Secretos en GitHub Actions** (SSH key, EXPO_TOKEN, DATABASE_URL staging). Usar GitHub Secrets, nunca commitear.
- **Maestro flaky tests**: si fallan por timing, aumentar `waitForAnimationToEnd` y usar `extendedWaitUntil`.

## Criterio de "80 alcanzado"

- Fase A merged + deployed → 65
- Fase B merged + CI verde en ambos repos + coverage backend `routes/` ≥ 80% → 75
- Fase C staging operacional + deploy prod con gate de tests + 1 PR completo end-to-end → 80

Una vez 80: monitorear Sentry 1 semana, si no hay P0/P1, abrir público.
