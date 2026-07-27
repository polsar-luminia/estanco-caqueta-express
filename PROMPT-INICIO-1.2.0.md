# Prompt de arranque — Release 1.2.0 de Estanco Caquetá Express

> Copiar todo lo que sigue (desde la línea punteada) y pegarlo como primer mensaje en la sesión
> nueva. Generado 2026-07-26.

---

Vas a ejecutar el release 1.2.0 de **Estanco Caquetá Express** (app de domicilios de licores en
Florencia, Caquetá). El trabajo ya está planeado y aprobado. **Tu tarea es construirlo, no
re-planearlo.**

## Regla número uno

**Antes de escribir una sola línea de código, lee el plan completo:**
`/Users/polsar23/Desktop/Desarrollo/estanco-caqueta-express/PLAN-1.2.0.md`

Tiene ocho bloques (A–H) con esquema SQL, endpoints, UI, telemetría y criterios de verificación
para cada uno. Está discutido y decidido. **No propongas un plan alternativo, no re-investigues lo
que ya está resuelto, no cambies decisiones sin preguntar.** Si algo del plan te parece equivocado,
dilo en una o dos frases y sigue; si es grave, pregunta antes de desviarte.

Lecturas de apoyo (solo si las necesitas, no de entrada):
- `INVESTIGACION-UBICACION-Y-ACCESIBILIDAD.md` — de dónde salieron los bloques E y F
- `AUDITORIA-SEGURIDAD-2026-07-22.md` — deudas conocidas
- `/Users/polsar23/Desktop/Desarrollo/CLAUDE.md` — reglas del workspace
- `/Users/polsar23/Desktop/Desarrollo/Polo & Salazar/Polo Dashboard/CLAUDE.md` — reglas del backend

## Dónde vive cada cosa

Son **dos repos distintos**, ninguno es monorepo con el otro:

| Qué | Ruta | Notas |
|---|---|---|
| App móvil (React Native + Expo) | `~/Desktop/Desarrollo/estanco-caqueta-express` | Rama actual `release/1.1.5`, la default es `master` |
| API + admin web | `~/Desktop/Desarrollo/Polo & Salazar/Polo Dashboard` | `packages/api`, `packages/app-admin`, `packages/shared` |

Estanco **no usa Supabase**: usa PostgreSQL propio (`polo_dashboard`) en el VPS.

**Empieza creando la rama `release/1.2.0`** desde `release/1.1.5` en el repo de la app, y trabaja
ahí. Commit por bloque terminado, en español, sin emojis.

## Orden de ejecución (no lo cambies)

```
A  zonas multi-polígono + editor admin + tarifa por zona + TELEMETRÍA COMPLETA
H  frío asegurado  ← justo después de A: comparten el refactor del total del carrito
B  herramienta de domiciliarios
C  reseñas
D  motor de ETA
E  accesibilidad Nivel 1
F  ubicación obligatoria
G  build 1.2.0 / 65  ← al final, semana del 3-ago
```

A va primero porque D, F y la tarifa dependen de las zonas, y porque **ningún bloque siguiente
puede nacer sin sus eventos**. H pegado a A porque los dos tocan el cálculo del total en
`app/(tabs)/cart.tsx`: hacerlos separados es tocar dos veces el punto donde un error cobra de más.

## Entrega: un solo release, sin OTA parcial

Decidido el 26-jul. **Nada sale por OTA.** Los ocho bloques se construyen completos y viajan juntos
en el binario 1.2.0. Semana 1 (27–31 jul) construir; semana 2 (3–7 ago) QA, build y publicación.

- **Backend y admin sí se despliegan a medida que se terminan** — no dependen de la tienda.
- **Única excepción de OTA:** el candado dormido del bloque G. Tiene que llegar a los binarios
  viejos o el bloqueo de versión no sirve para nada. No lleva ninguna funcionalidad de A–H.
- Versión actual: `1.1.5` / build `64` → objetivo `1.2.0` / build `65` en `app.json`.

## Guardarraíles — no negociables

1. **Telemetría en el mismo commit que la funcionalidad, nunca "después".** Cada evento exige dos
   registros en `src/lib/tracker.ts`: el tipo en `EventTipo` y sus keys en `ALLOWED_KEYS`.
   La allowlist es **default-deny** (M-OBS-21): lo que no está registrado se descarta en silencio.
   **Jamás la debilites** — es lo que impide filtrar PII por accidente.
2. **Cero PII en payloads.** Nada de teléfono, nombre, dirección, email ni coordenadas exactas de
   casas. Solo IDs. Las coordenadas de `fuera_de_zona` van redondeadas a 3 decimales.
3. **Toda funcionalidad riesgosa nace con su bandera apagada**: `exigir_ubicacion`, `frio_activo`,
   `frio_recordatorio_activo`, `eta_visible_cliente`. Las banderas viven en la tabla `configuracion`
   y se prenden desde el servidor, de a una, días después del lanzamiento.
4. **El servidor es la autoridad sobre la plata.** Envío, cupón y frío se calculan en
   `POST /pedidos`, nunca se confía en lo que manda el cliente. El carrito muestra, el servidor cobra.
5. **Patrón COALESCE obligatorio** en toda query del catálogo (`nombre_app`, `categoria_app_id`).
   Si lo olvidas, el cliente ve `TEQ. CENTENARIO*700ML` en vez de `Tequila Centenario 700ml`.
6. **`permite_frio` (bloque H) es columna protegida**: agrégala a la lista que los syncs de Tryton
   y Shopify no pueden sobrescribir, o la próxima corrida borra la curaduría hecha a mano.
7. **Ninguna librería nativa nueva.** Todo lo del plan se puede hacer con lo que ya está instalado.
8. **No dupliques la máquina de estados** de `packages/api/src/routes/pedidos-staff.js` en el bloque
   B: extrae un helper compartido. El descuento de `stock_manual` está hecho para ocurrir
   exactamente una vez.
9. **Push de reseñas y de "no alcanzó frío" son transaccionales**, van fuera del cap de marketing
   (2/semana) en `notificaciones.js`.
10. Español colombiano en UI y comentarios, COP con separador de punto, `dd/MM/yyyy`,
    timezone `America/Bogota`. **Sin emojis en el código.**

## Base de datos y deploy

- **VPS:** `ssh polo` (alias de root@38.242.248.138, llave SSH, sin password).
- **API:** PM2 `polo-api` en el puerto 3002, código en `/opt/polo/src/packages/api/`.
- `/opt/polo/src` es un checkout de `main` de `polsar-luminia/polo-dashboard`, sincronizado con el
  Mac por un cron cada 10 min. **Sincronizar NO es desplegar**: bajar un archivo no reinicia
  `polo-api` ni recompila el admin. Después de tocar la API: `pm2 restart polo-api`.
- **Admin:** `cd /opt/polo/src/packages/app-admin && npm run build && rsync -a --delete dist/ /var/www/estanco-admin/`
- **Migraciones:** `packages/shared/src/migrations/`, numeradas y **idempotentes**
  (`ADD COLUMN IF NOT EXISTS`). La última aplicada es `047_whatsapp_webhook.sql`, **empieza en 048**.
- Guía completa: `~/Desktop/Desarrollo/DEPLOY-ACCESO-VPS-ESTANCO.md`

## Verificación

Cada bloque tiene su criterio en la sección *Verificación* del plan — cúmplelos, no los inventes.
Además, en el repo de la app, antes de cerrar cualquier bloque:

```bash
npx vitest run && npx tsc --noEmit
```

## Lo que está bloqueado y NO debe frenarte

La pieza gráfica del recordatorio de frío (bloque H) **está pendiente de re-exportar** por el dueño:
hay que quitarle el precio, la letra pequeña de las categorías y los botones, porque todo eso es
configurable desde el admin y una imagen estática mentiría. Mientras tanto:

- Construye la tarjeta leyendo `frio_imagen_url` desde `configuracion`.
- Que funcione con la URL vacía o rota: sale sin imagen y **el pedido se completa igual**.
- Precio, productos elegibles, total y botones son **texto y componentes nativos**, no píxeles.

## Cómo arrancar

1. Lee `PLAN-1.2.0.md` completo.
2. Crea la rama `release/1.2.0`.
3. Dime en pocas líneas cómo vas a atacar el **bloque A** y arranca. No me pidas permiso para cada
   archivo; sí avísame antes de aplicar una migración en producción o de reiniciar `polo-api`.
